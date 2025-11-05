exports.wrap = (res, code, message, data) => res.status(code).json({ message, data });

exports.parseJSON = (str, fallback) => {
  if (str === undefined) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
};

exports.applyQueryParams = (req, q, defaults = {}) => {
  const where = exports.parseJSON(req.query.where, {});
  const sort = exports.parseJSON(req.query.sort, undefined);
  const select = exports.parseJSON(req.query.select, undefined);
  const skip = req.query.skip ? Number(req.query.skip) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : defaults.limit;

  if (where) q.find(where);
  if (sort) q.sort(sort);
  if (select) q.select(select);
  if (skip !== undefined) q.skip(skip);
  if (limit !== undefined) q.limit(limit);

  return { countOnly: String(req.query.count) === 'true', where };
};
