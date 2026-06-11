function log(level, message, fields = {}) {
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

// Raw error.message from drivers can echo fragments of the offending data
// (e.g. Postgres check-constraint violations quote the value). Log only the
// class and machine code, never the message.
function describeError(error) {
  const fields = { errorName: (error && error.name) || "Error" };
  if (error && error.code) fields.errorCode = String(error.code);
  return fields;
}

module.exports = {
  info(message, fields) {
    log("info", message, fields);
  },
  warn(message, fields) {
    log("warn", message, fields);
  },
  error(message, fields) {
    log("error", message, fields);
  },
  describeError,
};
