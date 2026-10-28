import {
  executeStep,
  resolveValue,
  send,
  validSteps,
  type Flow,
  type Step,
} from "./model.ts";
export type Iteration = {
  index: number;
  item: unknown;
  status: "success" | "error" | "skipped";
  steps: Record<string, unknown>;
  error?: string;
};
export type LoopOutput = {
  total: number;
  completed: number;
  iterations: Iteration[];
  current?: { index: number; item: unknown; steps: Record<string, unknown> };
};
export type Progress = {
  index: number;
  total: number;
  completed: number;
  childId?: string;
};
export class FlowRunner {
  flow: Flow;
  environment: Record<string, unknown>;
  sender: typeof send;
  onUpdate?: () => void;
  outputs: Record<string, unknown>;
  states: Record<string, string> = {};
  progress: Record<string, Progress> = {};
  next: number;
  selectedId: string | undefined;
  frame?: {
    step: Step;
    items: unknown[];
    index: number;
    child: number;
    values: Record<string, unknown>;
    result: LoopOutput;
  };
  constructor(
    flow: Flow,
    environment: Record<string, unknown>,
    start = 0,
    previous: Record<string, unknown> = {},
    sender = send,
  ) {
    this.flow = flow;
    this.environment = environment;
    this.sender = sender;
    if (!validSteps(flow.steps))
      throw Error(
        "Invalid flow: loops cannot be nested and step IDs must be unique",
      );
    this.outputs = { ...previous };
    this.next = start;
    for (const s of flow.steps.slice(start)) {
      delete this.outputs[s.id];
      for (const c of s.children ?? []) delete this.outputs[c.id];
    }
  }
  get done() {
    return this.next >= this.flow.steps.length;
  }
  get expectedChild() {
    return this.frame?.step.children?.[this.frame.child]?.id;
  }
  snapshot() {
    return {
      outputs: structuredClone(this.outputs),
      states: { ...this.states },
      progress: structuredClone(this.progress),
      next: this.next,
      selectedId: this.selectedId,
    };
  }
  async tick(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.done) return;
    const step = this.flow.steps[this.next];
    this.selectedId = step.id;
    this.states[step.id] = "running";
    this.onUpdate?.();
    try {
      if (step.kind !== "loop") {
        const value = await executeStep(
          step,
          { ...this.environment, steps: this.outputs },
          signal,
          this.sender,
        );
        this.outputs[step.id] = value;
        this.states[step.id] = "success";
        this.next++;
        if (step.kind === "condition" && value === false) {
          for (const s of this.flow.steps.slice(this.next)) {
            this.states[s.id] = "skipped";
            for (const c of s.children ?? []) this.states[c.id] = "skipped";
          }
          this.next = this.flow.steps.length;
        }
        return;
      }
      if (!this.frame) {
        const input = resolveValue(step.value, {
          ...this.environment,
          steps: this.outputs,
        });
        let items: unknown[];
        if (step.loop!.mode === "repeat") {
          if (
            typeof input !== "number" ||
            !Number.isInteger(input) ||
            input < 0
          )
            throw Error("Repeat count must be a non-negative integer");
          if (input > step.loop!.maxIterations)
            throw Error(
              `Repeat count ${input} exceeds limit ${step.loop!.maxIterations}. No rounds were executed.`,
            );
          items = Array.from({ length: input }, (_, index) => index);
        } else {
          if (!Array.isArray(input))
            throw Error("Loop input must resolve to an Array");
          items = input;
        }
        if (!Array.isArray(items))
          throw Error("Loop input must resolve to an Array");
        if (items.length > step.loop!.maxIterations)
          throw Error(
            `Loop has ${items.length} items; limit is ${step.loop!.maxIterations}. No items were executed.`,
          );
        if (!step.children?.length)
          throw Error("Add at least one step inside the loop");
        this.frame = {
          step,
          items,
          index: 0,
          child: 0,
          values: {},
          result: { total: items.length, completed: 0, iterations: [] },
        };
        this.outputs[step.id] = this.frame.result;
        this.progress[step.id] = {
          index: 0,
          total: items.length,
          completed: 0,
        };
        if (!items.length) {
          this.states[step.id] = "success";
          this.next++;
          this.frame = undefined;
          return;
        }
      }
      const frame = this.frame,
        child = step.children![frame.child];
      if (frame.child === 0)
        for (const c of step.children!) this.states[c.id] = "ready";
      this.selectedId = child.id;
      this.states[child.id] = "running";
      this.progress[step.id] = {
        index: frame.index,
        total: frame.items.length,
        completed: frame.result.completed,
        childId: child.id,
      };
      this.onUpdate?.();
      let iterationStatus: Iteration["status"] = "success",
        error: string | undefined,
        finish = false;
      try {
        const previous = { ...this.outputs };
        delete previous[step.id];
        const value = await executeStep(
          child,
          {
            ...this.environment,
            steps: { ...previous, ...frame.values },
            loop: {
              item: frame.items[frame.index],
              index: frame.index,
              number: frame.index + 1,
              total: frame.items.length,
            },
          },
          signal,
          this.sender,
        );
        frame.values[child.id] = value;
        this.states[child.id] = "success";
        if (child.kind === "condition" && value === false) {
          iterationStatus = "skipped";
          finish = true;
        }
      } catch (e) {
        this.states[child.id] = signal.aborted ? "stopped" : "error";
        error = (e as Error).message;
        iterationStatus = "error";
        finish = true;
        if (signal.aborted || step.loop!.errorMode === "stop") {
          frame.result.iterations.push({
            index: frame.index,
            item: frame.items[frame.index],
            status: "error",
            steps: { ...frame.values },
            error,
          });
          for (const c of step.children!.slice(frame.child + 1))
            this.states[c.id] = "skipped";
          this.frame = undefined;
          throw e;
        }
      }
      frame.result.current = {
        index: frame.index,
        item: frame.items[frame.index],
        steps: { ...frame.values },
      };
      frame.child++;
      if (finish || frame.child >= step.children!.length) {
        if (finish)
          for (const c of step.children!.slice(frame.child))
            this.states[c.id] = "skipped";
        frame.result.iterations.push({
          index: frame.index,
          item: frame.items[frame.index],
          status: iterationStatus,
          steps: { ...frame.values },
          ...(error ? { error } : {}),
        });
        delete frame.result.current;
        frame.result.completed++;
        frame.index++;
        frame.child = 0;
        frame.values = {};
      }
      this.progress[step.id] = {
        index: Math.min(frame.index, frame.items.length - 1),
        total: frame.items.length,
        completed: frame.result.completed,
        childId: step.children![frame.child]?.id,
      };
      this.states[step.id] = "paused";
      if (frame.index >= frame.items.length) {
        this.states[step.id] = frame.result.iterations.some(
          (i) => i.status === "error",
        )
          ? "warning"
          : "success";
        this.next++;
        this.frame = undefined;
      }
    } catch (e) {
      this.states[step.id] = signal.aborted ? "stopped" : "error";
      throw e;
    }
  }
}
