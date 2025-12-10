type Job = { name: string; data: any; attempts?: number; backoffMs?: number };

const queue: Job[] = [];

export function enqueue(job: Job) {
  job.attempts = job.attempts ?? 0;
  job.backoffMs = job.backoffMs ?? 2000;
  queue.push(job);
}

export function startQueueProcessor(processors: Record<string, (data: any) => Promise<void>>) {
  async function loop() {
    const job = queue.shift();
    if (job) {
      try {
        await processors[job.name](job.data);
      } catch (_e) {
        job.attempts = (job.attempts ?? 0) + 1;
        if (job.attempts! <= 5) {
          setTimeout(() => queue.push(job), job.backoffMs);
        }
      }
    }
    setTimeout(loop, 250);
  }
  loop();
}
