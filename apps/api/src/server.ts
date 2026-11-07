import { loadServerEnv, redactEnv } from "@makarba/config";
import { Authorizer, assertPolicyUsable, loadMatrix } from "@makarba/authz";
import { createApp } from "./app.js";
import { safeRequestLogger } from "./logging.js";

const env = loadServerEnv(process.env);
// Production must never run on a capability matrix that stakeholders have not approved (issue #6).
assertPolicyUsable(new Authorizer(loadMatrix()), env.APP_ENV);
const app = createApp();
app.use(safeRequestLogger());
app.listen(env.API_PORT, () => console.log("api listening", JSON.stringify(redactEnv(env))));
