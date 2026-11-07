import { loadServerEnv, redactEnv } from "@makarba/config";
import { Authorizer, assertPolicyUsable, loadMatrix } from "@makarba/authz";
import { createApp } from "./app.js";

const env = loadServerEnv(process.env);
// Production must never run on a capability matrix that stakeholders have not approved (issue #6).
assertPolicyUsable(new Authorizer(loadMatrix()), env.APP_ENV);
createApp().listen(env.API_PORT, () => console.log("api listening", JSON.stringify(redactEnv(env))));
