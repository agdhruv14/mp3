const Task = require('../models/task');
const User = require('../models/user');
const H = require('./helpers');

module.exports = function (router) {
  const r = router;

  r.get('/', async (req, res) => {
    const q = Task.find();
    const { countOnly, where } = H.applyQueryParams(req, q, { limit: 100 });
    if (countOnly) {
      const c = await Task.countDocuments(where || {});
      return H.wrap(res, 200, 'OK', c);
    }
    const rows = await q.exec();
    return H.wrap(res, 200, 'OK', rows);
  });

  r.post('/', async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.deadline) return H.wrap(res, 400, 'name and deadline are required', null);

    let assignedUser = b.assignedUser || '';
    let assignedUserName = b.assignedUserName || 'unassigned';
    if (assignedUser && !b.assignedUserName) {
      const u = await User.findById(assignedUser); 
      assignedUserName = u ? u.name : 'unassigned';
    }

    const created = await Task.create({
      name: b.name,
      description: b.description || '',
      deadline: b.deadline,
      completed: !!b.completed,
      assignedUser,
      assignedUserName,
    });

    if (assignedUser && !created.completed) {
      await User.updateOne(
        { _id: assignedUser, pendingTasks: { $ne: String(created._id) } },
        { $push: { pendingTasks: String(created._id) } }
      );
    }
    return H.wrap(res, 201, 'Created', created);
  });

  r.get('/:id', async (req, res) => {
    const select = H.parseJSON(req.query.select, undefined);
    const t = await Task.findById(req.params.id).select(select || undefined);
    if (!t) return H.wrap(res, 404, 'Task not found', null);
    return H.wrap(res, 200, 'OK', t);
  });

  r.put('/:id', async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.deadline) return H.wrap(res, 400, 'name and deadline are required', null);

    const t = await Task.findById(req.params.id);
    if (!t) return H.wrap(res, 404, 'Task not found', null);

    const prevUser = t.assignedUser || '';
    const nextUser = b.assignedUser || '';
    let nextUserName = b.assignedUserName || 'unassigned';
    if (nextUser && !b.assignedUserName) {
      const u = await User.findById(nextUser); 
      nextUserName = u ? u.name : 'unassigned';
    }

    t.name = b.name;
    t.description = b.description || '';
    t.deadline = b.deadline;
    t.completed = !!b.completed;
    t.assignedUser = nextUser;
    t.assignedUserName = nextUser ? nextUserName : 'unassigned';
    await t.save();

    if (prevUser && prevUser !== nextUser) {
      await User.updateOne({ _id: prevUser }, { $pull: { pendingTasks: String(t._id) } });
    }
    if (nextUser && !t.completed) {
      await User.updateOne(
        { _id: nextUser, pendingTasks: { $ne: String(t._id) } },
        { $push: { pendingTasks: String(t._id) } }
      );
    }
    if (t.completed && nextUser) {
      await User.updateOne({ _id: nextUser }, { $pull: { pendingTasks: String(t._id) } });
    }

    return H.wrap(res, 200, 'OK', t);
  });

  r.delete('/:id', async (req, res) => {
    const t = await Task.findById(req.params.id);
    if (!t) return H.wrap(res, 404, 'Task not found', null);

    if (t.assignedUser) {
      await User.updateOne({ _id: t.assignedUser }, { $pull: { pendingTasks: String(t._id) } });
    }
    await t.deleteOne();
    return H.wrap(res, 200, 'Deleted', null);
  });

  return r;
};
