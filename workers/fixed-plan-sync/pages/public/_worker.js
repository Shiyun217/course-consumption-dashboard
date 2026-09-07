import worker from '../../worker.mjs';

export default {
  fetch(request, env) {
    return worker.fetch(request, env);
  },
};
