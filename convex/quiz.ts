import { query } from "./_generated/server";
export const getQuiz = query({
  args: {},
  handler: async (ctx) => ctx.db.query("quizOptions").collect(),
});
