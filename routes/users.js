const User = require('../models/user');
const Task = require('../models/task');
const H = require('./helpers');

const asStrArray = (v) =>
  Array.isArray(v) ? v.map(String) : (v == null ? [] : [String(v)]);

module.exports = function (router) {
  const r = router;

  r.get('/', async (req, res) => {
    const q = User.find();
    const { countOnly, where } = H.applyQueryParams(req, q);
    if (countOnly) {
      const c = await User.countDocuments(where || {});
      return H.wrap(res, 200, 'OK', c);
    }
    const users = await q.exec();
    return H.wrap(res, 200, 'OK', users);
  });

  r.post('/', async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.email) return H.wrap(res, 400, 'name and email are required', null);
    try {
      const created = await User.create({
        name: b.name,
        email: b.email,
        pendingTasks: asStrArray(b.pendingTasks),
      });

      if (created.pendingTasks.length) {
        await Task.updateMany(
          { _id: { $in: created.pendingTasks } },
          { assignedUser: String(created._id), assignedUserName: created.name }
        );
      }
      return H.wrap(res, 201, 'Created', created);
    } catch (e) {
      if (e && e.code === 11000) return H.wrap(res, 400, 'email must be unique', null);
      return H.wrap(res, 500, 'Server error', e.message);
    }
  });

  r.get('/:id', async (req, res) => {
    const select = H.parseJSON(req.query.select, undefined);
    const u = await User.findById(req.params.id).select(select || undefined);
    if (!u) return H.wrap(res, 404, 'User not found', null);
    return H.wrap(res, 200, 'OK', u);
  });

  r.put('/:id', async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.email) return H.wrap(res, 400, 'name and email are required', null);

    const user = await User.findById(req.params.id);
    if (!user) return H.wrap(res, 404, 'User not found', null);

    const prev = new Set(user.pendingTasks.map(String));
    const next = new Set(asStrArray(b.pendingTasks));

    user.name = b.name;
    user.email = b.email;
    user.pendingTasks = [...next];
    await user.save();

    const added = [...next].filter((id) => !prev.has(id));
    if (added.length) {
      await Task.updateMany(
        { _id: { $in: added } },
        { assignedUser: String(user._id), assignedUserName: user.name }
      );
    }

    const removed = [...prev].filter((id) => !next.has(id));
    if (removed.length) {
      await Task.updateMany(
        { _id: { $in: removed }, assignedUser: String(user._id) },
        { assignedUser: '', assignedUserName: 'unassigned' }
      );
    }

    return H.wrap(res, 200, 'OK', user);
  });

  r.delete('/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return H.wrap(res, 404, 'User not found', null);

    if (user.pendingTasks.length) {
      await Task.updateMany(
        { _id: { $in: user.pendingTasks } },
        { assignedUser: '', assignedUserName: 'unassigned' }
      );
    }
    await user.deleteOne();
    return H.wrap(res, 200, 'Deleted', null);
  });

  return r;
};
