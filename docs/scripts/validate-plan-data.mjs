import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async relativePath => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
const fail = message => { throw new Error(message); };
const requireText = (value, label) => { if (typeof value !== 'string' || !value.trim()) fail(`${label} must be non-empty text`); };
const requireTextArray = (value, label) => {
  if (!Array.isArray(value) || !value.length) fail(`${label} must be a non-empty array`);
  value.forEach((item, index) => requireText(item, `${label}[${index}]`));
};

const [plan, teams, deliverables] = await Promise.all([
  readJson('data/plan.json'),
  readJson('data/teams.json'),
  readJson('data/deliverables.json')
]);

if (!Array.isArray(plan.developerIds) || plan.developerIds.length !== 14) fail('plan.json must list exactly 14 developers');
if (new Set(plan.developerIds).size !== plan.developerIds.length) fail('plan.json contains duplicate developer IDs');
if (!Array.isArray(plan.weekThemes) || plan.weekThemes.length !== 8) fail('plan.json must contain eight week themes');
if (!Array.isArray(plan.teamOrder) || plan.teamOrder.length !== 3) fail('plan.json must contain three teams');

const teamDeveloperIds = [];
for (const teamKey of plan.teamOrder) {
  const team = teams[teamKey];
  if (!team) fail(`teams.json is missing ${teamKey}`);
  ['name', 'short', 'mission', 'map'].forEach(key => requireText(team[key], `${teamKey}.${key}`));
  requireTextArray(team.boundaries, `${teamKey}.boundaries`);
  requireTextArray(team.dependencies, `${teamKey}.dependencies`);
  if (!Array.isArray(team.developerIds) || !team.developerIds.length) fail(`${teamKey}.developerIds must be a non-empty array`);
  teamDeveloperIds.push(...team.developerIds);
}
if (teamDeveloperIds.join('|') !== plan.developerIds.join('|')) fail('Team developer order must match plan.developerIds');

let taskCount = 0;
for (const id of plan.developerIds) {
  const developer = await readJson(`data/developers/${id}.json`);
  if (developer.id !== id) fail(`${id}.json contains ID ${developer.id}`);
  ['name', 'title', 'role'].forEach(key => requireText(developer[key], `${id}.${key}`));
  ['userValue', 'expectedOutput', 'acceptanceScenario'].forEach(key => requireText(developer.assignment?.[key], `${id}.assignment.${key}`));
  requireTextArray(developer.assignment?.build, `${id}.assignment.build`);
  requireTextArray(developer.rules, `${id}.rules`);
  requireTextArray(developer.dependencies, `${id}.dependencies`);
  requireTextArray(developer.failureModes, `${id}.failureModes`);
  requireTextArray(developer.excluded, `${id}.excluded`);
  if (!Array.isArray(developer.weeks) || developer.weeks.length !== 8) fail(`${id} must have eight weekly tasks`);
  developer.weeks.forEach((task, index) => {
    if (task.week !== index + 1) fail(`${id} task ${index + 1} has the wrong week number`);
    requireText(task.title, `${id}.weeks[${index}].title`);
    requireText(task.description, `${id}.weeks[${index}].description`);
    requireText(task.verification, `${id}.weeks[${index}].verification`);
    if (!task.productContext) fail(`${id} Week ${task.week} must contain product context`);
    requireText(task.productContext.introduction, `${id}.weeks[${index}].productContext.introduction`);
    if (!Array.isArray(task.productContext.flow) || task.productContext.flow.length !== 4) fail(`${id} Week ${task.week} product context must have four flow steps`);
    task.productContext.flow.forEach((step, stepIndex) => ['label', 'title', 'description'].forEach(key => requireText(step[key], `${id}.weeks[${index}].productContext.flow[${stepIndex}].${key}`)));
    requireTextArray(task.productContext.integrationCheckpoint, `${id}.weeks[${index}].productContext.integrationCheckpoint`);
    requireTextArray(task.productContext.doneWhen, `${id}.weeks[${index}].productContext.doneWhen`);
    taskCount += 1;
  });
}

if (!Array.isArray(deliverables) || !deliverables.length) fail('deliverables.json must contain deliverables');
const deliverableIds = new Set();
let availableDeliverableLinks = 0;
let pendingDeliverableLinks = 0;
for (const [index, deliverable] of deliverables.entries()) {
  ['id', 'name', 'whatTheyReceive', 'usedFor', 'readyWhen'].forEach(key => requireText(deliverable[key], `deliverables[${index}].${key}`));
  requireTextArray(deliverable.teams, `deliverables[${index}].teams`);
  if (deliverableIds.has(deliverable.id)) fail(`Duplicate deliverable ID: ${deliverable.id}`);
  deliverableIds.add(deliverable.id);
  requireText(deliverable.link?.label, `deliverables[${index}].link.label`);
  const href = deliverable.link?.href;
  if (href === null) {
    pendingDeliverableLinks += 1;
    continue;
  }
  requireText(href, `deliverables[${index}].link.href`);
  if (!/^(?:https?:\/\/)/.test(href)) {
    if (href.startsWith('/')) fail(`deliverables[${index}].link.href must be relative or an absolute web URL`);
    const [relativePath, fragment] = href.split('#');
    const targetPath = path.join(root, relativePath);
    await access(targetPath);
    if (fragment) {
      const target = await readFile(targetPath, 'utf8');
      if (!target.includes(`id="${fragment}"`)) fail(`deliverables[${index}].link.href points to missing anchor #${fragment}`);
    }
  }
  availableDeliverableLinks += 1;
}
console.log(`Validated ${plan.developerIds.length} developers, ${taskCount} weekly tasks, ${deliverables.length} supplied inputs, ${availableDeliverableLinks} available links, and ${pendingDeliverableLinks} pending links.`);
