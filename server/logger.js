function write(level, message, fields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.log(line);
}

function child(baseFields = {}) {
  return {
    info(message, fields) {
      write("info", message, { ...baseFields, ...(fields || {}) });
    },
    warn(message, fields) {
      write("warn", message, { ...baseFields, ...(fields || {}) });
    },
    error(message, fields) {
      write("error", message, { ...baseFields, ...(fields || {}) });
    },
  };
}

module.exports = {
  logger: child(),
  createLogger: child,
};
