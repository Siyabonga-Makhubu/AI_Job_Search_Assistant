import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`Resume RAG backend listening on port ${env.port}`);
});
