const queue = new Queue('batch-updates');

queue.process(async (job) => {
  const { logs } = job.data;
  await CommunicationLog.updateMany(
    { _id: { $in: logs.map(log => log._id) } },
    { $set: { status: log.status } }
  );
});

// Add logs to the queue
queue.add({ logs }); 