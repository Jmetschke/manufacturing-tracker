let reportData = [];
let allEntries = [];
let flaggedReviewEntries = [];
let concernEntries = [];
let allItems = [];
let allTasks = [];
let itemTaskOptionsByItemId = {};
let itemTaskManagementAssignments = [];
let allOrderedItems = [];
let allOrderRequests = [];
let adminScheduleRows = new Map();
let adminExpectedDeliveriesByDate = new Map();
let adminActiveScheduleByDate = new Map();
let adminCalendarStartDate = null;
let productionNeedsRows = [];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const eventCompanyOptions = ["Snackbar", "Hijnx", "Snackbar & Hijnx"];
const hijnxBatchOptions = [
  "Alpha Chunk - 1pk",
  "Alpha Chunk - 2pk",
  "Chill Chunk - 1pk",
  "Chill Chunk - 2pk",
  "Hijnx Sampler Medley Bag",
  "Hijnx Shooter - Sour Blue Razz 2oz",
  "Hijnx Shooter - Triple Citrus",
  "Hijnx Shooter - Watermelon",
  "MiNi's Chunks - 10pk",
  "Micro Dots",
  "Pheotera 2oz Stick",
  "Hijnx 1oz Stick",
  "Rex Chunk - 2pk",
  "Sleep Chunk - 1pk",
  "Sleep Chunk - 2pk",
  "Sugar Free MiNi's - 10pk",
  "Whoopie Hi",
  "Zuul Chunk - 2pk"
];
const sbBatchOptions = [
  "Snackbar Vape - Cherry Pomegranate Lemon 2g",
  "Snackbar Vape - Grape Crush",
  "Snackbar Vape - Lemon Yuzu",
  "Snackbar Vape - Mango Magic",
  "Snackbar Vape - Peach Passion Fruit 2g",
  "Snackbar Vape - Strawberry Dragonfruit 2g",
  "Snackbar Vape - Watermelon Lychee 1g"
];
const batchChecklistItems = [
  { key: "cooking", label: "Cooking" },
  { key: "postCookingProcessing", label: "Post cooking processing" },
  { key: "packaging", label: "Packaging" },
  { key: "sealed", label: "Sealed" },
  { key: "counted", label: "Counted" },
  { key: "finalCountEnteredMetrc", label: "Final count entered in Metrc" }
];

function getItemProductionCompany(item) {
  return String(item && item.production_company ? item.production_company : "").trim().toLowerCase();
}

function getProductionBatchOptions(type) {
  const company = type === "hijnx" ? "hijnx" : "snackbar";
  const baseOptions = type === "hijnx" ? hijnxBatchOptions : sbBatchOptions;
  const itemOptions = allItems
    .filter(item => getItemProductionCompany(item) === company)
    .map(item => item.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return [...new Set([...baseOptions, ...itemOptions])];
}

function getAllProductionBatchOptions() {
  return [...new Set([
    ...getProductionBatchOptions("hijnx"),
    ...getProductionBatchOptions("sb")
  ])];
}

const chunkBatchTaskTemplate = [
  { order: 1, task: "Depositing (truffly)" },
  { order: 2, task: "Nerding" },
  { order: 3, task: "Popping" },
  { order: 4, task: "Sugaring" },
  { order: 5, task: "Packaging" },
  { order: 6, task: "Sealing" },
  { order: 7, task: "Counting (5's)" },
  { order: 8, task: "Bagging (20's)" }
];
const miniBatchTaskTemplate = [
  { order: 1, task: "Depositing (muffly)" },
  { order: 1, task: "Depositing (truffly)" },
  { order: 2, task: "Nerding" },
  { order: 3, task: "Popping" },
  { order: 4, task: "Sugaring" },
  { order: 5, task: "Packaging" },
  { order: 6, task: "Sealing" },
  { order: 7, task: "Counting (5's)" },
  { order: 8, task: "Bagging (20's)" }
];
const shooterBatchTaskTemplate = [
  { order: 1, task: "Filling (Filling Machine)" },
  { order: 2, task: "Capping (shooters)" },
  { order: 3, task: "Seal-Stickering (shooters)" },
  { order: 4, task: "Bagging (10's)" }
];
const sbVapeBatchTaskTemplate = [
  { order: 1, task: "Filling (SB Vapes)" },
  { order: 2, task: "Capping (SB Vapes)" },
  { order: 3, task: "SB Sealing" },
  { order: 4, task: "Counting (SB 5's)" },
  { order: 5, task: "Bagging (SB 25's)" }
];
const batchTaskTemplatesByItem = {
  "Micro Dots (50-piece packs)": [
    { order: 1, task: "Popping" },
    { order: 2, task: "Packaging" },
    { order: 3, task: "Sealing" },
    { order: 4, task: "Counting (5's)" },
    { order: 5, task: "Bagging (20's)" }
  ],
  "RSO Whoopie Hi": [
    { order: 1, task: "Depositing (Beldos)" },
    { order: 2, task: "Packaging" },
    { order: 3, task: "Sealing" },
    { order: 4, task: "Counting (5's)" },
    { order: 5, task: "Bagging (10's)" }
  ],
  "Big Stick": [
    { order: 1, task: "Filling (Filling Machine)" },
    { order: 2, task: "Capping (Topicals)" },
    { order: 3, task: "Packaging" },
    { order: 4, task: "Sealing" },
    { order: 5, task: "Bagging (5's)" }
  ],
  "Small Stick": [
    { order: 1, task: "Capping (Topicals)" },
    { order: 2, task: "Packaging" },
    { order: 3, task: "Sealing" },
    { order: 4, task: "Counting (5's)" },
    { order: 5, task: "Bagging (20's)" }
  ],
  "Tiny Stick": [
    { order: 1, task: "Tiny Stick Filling (tray)" },
    { order: 2, task: "Capping (Topicals)" },
    { order: 3, task: "Packaging" },
    { order: 4, task: "Sealing" },
    { order: 5, task: "Counting (5's)" },
    { order: 6, task: "Bagging (20's)" }
  ],
  "Space Chunk OG 1 chunk (pcs)": chunkBatchTaskTemplate,
  "Space Chunk ALPHA OG 2 chunk (units)": chunkBatchTaskTemplate,
  "Space Chunk REX OG 1 chunk (units)": chunkBatchTaskTemplate,
  "Space Chunk REX OG 2 chunk (units)": chunkBatchTaskTemplate,
  "Space Chunk ZUUL OG 1 chunk (units)": chunkBatchTaskTemplate,
  "Space Chunk ZUUL OG 2 chunk (units)": chunkBatchTaskTemplate,
  "Space Chunk 1 chunk CBD 50mg 1-1 (pcs)": chunkBatchTaskTemplate,
  "Space Chunks CBD 2 chunks 1-1 (units)": chunkBatchTaskTemplate,
  "Space Chunk CBN 1 chunk (pcs)": chunkBatchTaskTemplate,
  "Space Chunk CBN 2 chunk (units)": chunkBatchTaskTemplate,
  "Space Chunk Mini 10 chunk (units)": miniBatchTaskTemplate,
  "Space Chunk SUGAR FREE 10pk (units)": miniBatchTaskTemplate,
  "Space Chunk SUGAR FREE 2pk (units)": chunkBatchTaskTemplate,
  "Shooters Triple Citrus": shooterBatchTaskTemplate,
  "Shooters Sour Watermelon": shooterBatchTaskTemplate,
  "Shooters Sour Blu Raz": shooterBatchTaskTemplate,
  "Grape 1g": sbVapeBatchTaskTemplate,
  "Mango 1g": sbVapeBatchTaskTemplate,
  "Lemon 1g": sbVapeBatchTaskTemplate,
  "Watermelon 1g": sbVapeBatchTaskTemplate,
  "Cherry 2g": sbVapeBatchTaskTemplate,
  "Strawberry 2g": sbVapeBatchTaskTemplate,
  "Peach 2g": sbVapeBatchTaskTemplate
};
const productionBatchItemAliases = {
  "Alpha Chunk - 1pk": "Space Chunk OG 1 chunk (pcs)",
  "Alpha Chunk - 2pk": "Space Chunk ALPHA OG 2 chunk (units)",
  "Chill Chunk - 1pk": "Space Chunk CBN 1 chunk (pcs)",
  "Chill Chunk - 2pk": "Space Chunk CBN 2 chunk (units)",
  "Hijnx Shooter - Sour Blue Razz 2oz": "Shooters Sour Blu Raz",
  "Hijnx Shooter - Triple Citrus": "Shooters Triple Citrus",
  "Hijnx Shooter - Watermelon": "Shooters Sour Watermelon",
  "MiNi's Chunks - 10pk": "Space Chunk Mini 10 chunk (units)",
  "Micro Dots": "Micro Dots (50-piece packs)",
  "Rex Chunk - 2pk": "Space Chunk REX OG 2 chunk (units)",
  "Sleep Chunk - 1pk": "Space Chunk CBN 1 chunk (pcs)",
  "Sleep Chunk - 2pk": "Space Chunk CBN 2 chunk (units)",
  "Sugar Free MiNi's - 10pk": "Space Chunk SUGAR FREE 10pk (units)",
  "Whoopie Hi": "RSO Whoopie Hi",
  "Zuul Chunk - 2pk": "Space Chunk ZUUL OG 2 chunk (units)",
  "Snackbar Vape - Cherry Pomegranate Lemon 2g": "Cherry 2g",
  "Snackbar Vape - Grape Crush": "Grape 1g",
  "Snackbar Vape - Lemon Yuzu": "Lemon 1g",
  "Snackbar Vape - Mango Magic": "Mango 1g",
  "Snackbar Vape - Peach Passion Fruit 2g": "Peach 2g",
  "Snackbar Vape - Strawberry Dragonfruit 2g": "Strawberry 2g",
  "Snackbar Vape - Watermelon Lychee 1g": "Watermelon 1g"
};

function showMessage(text, type = "") {
  const message = document.getElementById("message");
  message.textContent = text;
  message.className = type ? `message ${type}` : "message";
}

function formatProductionNeedValue(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function getProductionNeedClassName(status) {
  const key = String(status || "").toLowerCase();
  if (key.includes("critical")) return "critical";
  if (key.includes("below")) return "below-par";
  return "";
}

function renderProductionNeeds(rows = productionNeedsRows, metaText = "") {
  productionNeedsRows = Array.isArray(rows) ? rows : [];
  const list = document.getElementById("productionNeedsList");
  const meta = document.getElementById("productionNeedsMeta");
  if (!list || !meta) return;

  list.innerHTML = "";
  meta.textContent = metaText || (productionNeedsRows.length
    ? `${productionNeedsRows.length} SKU${productionNeedsRows.length === 1 ? "" : "s"} loaded`
    : "Upload a report to review needs beside the calendar.");

  if (!productionNeedsRows.length) {
    const empty = document.createElement("div");
    empty.className = "calendar-focus-empty";
    empty.textContent = "No production needs loaded.";
    list.appendChild(empty);
    return;
  }

  productionNeedsRows.forEach(row => {
    const card = document.createElement("article");
    card.className = `production-need-card ${getProductionNeedClassName(row.status)}`.trim();

    const sku = document.createElement("div");
    sku.className = "production-need-sku";
    sku.textContent = row.sku || "Unnamed SKU";
    card.appendChild(sku);

    const metrics = document.createElement("div");
    metrics.className = "production-need-metrics";
    [
      ["Projected", formatProductionNeedValue(row.projected)],
      ["Stockout", row.days_to_stockout === null || row.days_to_stockout === undefined ? "-" : `${formatProductionNeedValue(row.days_to_stockout)}d`],
      ["Batches", formatProductionNeedValue(row.batches_needed)]
    ].forEach(([labelText, valueText]) => {
      const metric = document.createElement("div");
      metric.className = "production-need-metric";

      const label = document.createElement("div");
      label.className = "production-need-label";
      label.textContent = labelText;
      metric.appendChild(label);

      const value = document.createElement("div");
      value.className = "production-need-value";
      value.textContent = valueText;
      metric.appendChild(value);

      metrics.appendChild(metric);
    });
    card.appendChild(metrics);
    list.appendChild(card);
  });
}

function getProductionNeedsMetaText(report) {
  const items = Array.isArray(report && report.items) ? report.items : [];
  if (!items.length) return "";

  const parts = [`${items.length} SKU${items.length === 1 ? "" : "s"} loaded`];
  if (report.file_name) parts.push(report.file_name);
  if (report.generated_at) parts.push(report.generated_at);
  if (report.uploaded_at) parts.push(`uploaded ${report.uploaded_at}`);
  return parts.join(" - ");
}

async function loadProductionNeedsReport() {
  const res = await adminFetch("/admin/production-needs/latest");
  if (!res.ok) {
    const text = await res.text();
    showMessage("Production needs load failed: " + text, "error");
    return;
  }

  const report = await res.json();
  renderProductionNeeds(report.items || [], getProductionNeedsMetaText(report));
}

function redirectToAdminAccess() {
  window.location.href = `/access?next=${encodeURIComponent("/admin.html")}`;
}

function handleAdminAccessResponse(res) {
  if (res.status === 401 || res.status === 403 || res.redirected && res.url.includes("/access")) {
    redirectToAdminAccess();
    return true;
  }

  return false;
}

async function adminFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (handleAdminAccessResponse(res)) {
    return new Response("Admin access code required", { status: 403 });
  }
  return res;
}

function fillSelect(select, options, placeholder = "") {
  select.innerHTML = "";

  if (placeholder) {
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.text = placeholder;
    select.appendChild(placeholderOption);
  }

  options.forEach(optionData => {
    const option = document.createElement("option");
    option.value = String(optionData.value);
    option.text = optionData.text;
    select.appendChild(option);
  });
}

function getItemIdByName(itemName) {
  const item = allItems.find(option => option.name === itemName);
  return item ? String(item.id) : "";
}

function getTaskNameById(taskId) {
  const task = allTasks.find(option => String(option.id) === String(taskId));
  return task ? task.name : "";
}

function getAllowedTaskNamesForItem(itemName) {
  const itemId = getItemIdByName(itemName);
  if (!itemId) return allTasks.map(task => task.name);

  return (itemTaskOptionsByItemId[itemId] || [])
    .map(getTaskNameById)
    .filter(Boolean);
}

function fillTaskFilterOptions(selectedTask = document.getElementById("task_filter").value) {
  const itemName = document.getElementById("item_filter").value;
  const taskNames = getAllowedTaskNamesForItem(itemName);
  const options = taskNames.map(task => ({ value: task, text: task }));

  fillSelect(document.getElementById("task_filter"), options, "All Tasks");

  if (selectedTask && taskNames.includes(selectedTask)) {
    document.getElementById("task_filter").value = selectedTask;
  }
}

function fillReviewTaskOptions(itemId, selectedTaskId = document.getElementById("review_edit_task").value) {
  const allowedTaskIds = new Set((itemTaskOptionsByItemId[String(itemId)] || []).map(String));
  const taskOptions = allTasks
    .filter(task => allowedTaskIds.size === 0 || allowedTaskIds.has(String(task.id)))
    .map(task => ({ value: task.id, text: task.name }));

  fillSelect(document.getElementById("review_edit_task"), taskOptions);

  if (selectedTaskId && taskOptions.some(task => String(task.value) === String(selectedTaskId))) {
    document.getElementById("review_edit_task").value = String(selectedTaskId);
  }
}

function buildItemTaskOptionsByItemId(assignments) {
  const optionsByItemId = {};

  assignments.forEach(assignment => {
    const itemId = String(assignment.item_id);
    if (!optionsByItemId[itemId]) {
      optionsByItemId[itemId] = [];
    }
    optionsByItemId[itemId].push(assignment.task_id);
  });

  return optionsByItemId;
}

function getTaskName(taskId) {
  const task = allTasks.find(option => String(option.id) === String(taskId));
  return task ? task.name : "";
}

function getSelectText(select) {
  if (!select || !select.value) return "";
  const option = select.options[select.selectedIndex];
  return option ? option.text : "";
}

function setupAdminDispensaryLocations() {
  const datalist = document.getElementById("adminDispensaryLocations");
  if (!datalist) return;

  datalist.innerHTML = "";
  (window.dispensaryLocations || []).forEach(location => {
    const option = document.createElement("option");
    option.value = location;
    datalist.appendChild(option);
  });
}

function updateAdminDispensaryField() {
  const input = document.getElementById("edit_dispensary_name");
  const itemSelect = document.getElementById("edit_item");
  if (!input || !itemSelect) return;

  const isDeliveryOrder = getSelectText(itemSelect).toLowerCase() === "delivery order";
  input.style.display = isDeliveryOrder ? "" : "none";
  input.disabled = !isDeliveryOrder;
  if (!isDeliveryOrder) input.value = "";
}

async function loadLookups() {
  const [items, tasks, taskOptions] = await Promise.all([
    fetch("/items").then(r => r.json()),
    fetch("/tasks").then(r => r.json()),
    fetch("/item-task-options").then(r => r.json())
  ]);

  allItems = items;
  allTasks = tasks;
  itemTaskOptionsByItemId = taskOptions;
  itemTaskManagementAssignments = Object.entries(taskOptions).flatMap(([itemId, taskIds]) =>
    taskIds.map(taskId => ({ item_id: Number(itemId), task_id: Number(taskId) }))
  );

  fillSelect(
    document.getElementById("item_filter"),
    allItems.map(item => ({ value: item.name, text: item.name })),
    "All Items"
  );

  fillSelect(
    document.getElementById("edit_item"),
    allItems.map(item => ({ value: item.id, text: item.name }))
  );
  document.getElementById("edit_item").addEventListener("change", updateAdminDispensaryField);

  fillSelect(
    document.getElementById("review_edit_item"),
    allItems.map(item => ({ value: item.id, text: item.name }))
  );
  document.getElementById("review_edit_item").addEventListener("change", () => {
    fillReviewTaskOptions(document.getElementById("review_edit_item").value);
  });

  fillSelect(
    document.getElementById("edit_task"),
    allTasks.map(task => ({ value: task.id, text: task.name }))
  );

  fillReviewTaskOptions(document.getElementById("review_edit_item").value);

  fillTaskFilterOptions();
  document.getElementById("item_filter").addEventListener("change", () => fillTaskFilterOptions());

  setupAdminDispensaryLocations();
  updateAdminDispensaryField();
}

function loadEmployeeSelects() {
  const employees = window.employeeNames.map(employee => ({
    value: employee,
    text: employee
  }));

  fillSelect(document.getElementById("employee_filter"), employees, "All Employees");
  fillSelect(document.getElementById("edit_employee"), employees);
  fillSelect(document.getElementById("review_edit_employee"), employees);
}

function secondsToHMS(sec) {
  const totalSeconds = Number(sec) || 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parseHMSToSeconds(value) {
  if (!value.trim()) return null;

  const parts = value.trim().split(":").map(part => part.trim());
  if (parts.some(part => !/^\d+$/.test(part))) return null;

  if (parts.length === 1) {
    const seconds = Number(parts[0]);
    return Number.isFinite(seconds) ? seconds : null;
  }

  if (parts.length !== 2 && parts.length !== 3) return null;

  const numbers = parts.map(part => Number(part));
  if (numbers.some(number => !Number.isInteger(number) || number < 0)) return null;

  const [hours, minutes, seconds] =
    parts.length === 2 ? [0, numbers[0], numbers[1]] : numbers;

  if (minutes >= 60 || seconds >= 60) return null;
  return Math.floor((hours * 3600) + (minutes * 60) + seconds);
}

function csvValue(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayIsoDate() {
  return toIsoDate(new Date());
}

function toMonthValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function getProjectedWorkDates(startDate, days) {
  const dates = [];
  let current = dateOnly(startDate);

  while (dates.length < days) {
    if (!isWeekend(current)) {
      dates.push(current);
    }

    current = addDays(current, 1);
  }

  return dates;
}

function isWeekendIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0 || date.getDay() === 6;
}

function monthStart(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function monthGridStart(date) {
  return addDays(date, -date.getDay());
}

function startOfWeek(date) {
  const start = dateOnly(date);
  return addDays(start, -start.getDay());
}

function formatDisplayDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeBatchList(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item && typeof item === "object") {
          const checklist = item.checklist && typeof item.checklist === "object" ? item.checklist : {};
          return {
            item: String(item.item || "").trim(),
            units: String(item.units || "").trim(),
            checklist: Object.fromEntries(
              batchChecklistItems.map(check => [check.key, Boolean(checklist[check.key])])
            )
          };
        }

        return {
          item: String(item || "").trim(),
          units: "",
          checklist: {}
        };
      })
      .filter(batch => batch.item);
  }

  const singleValue = String(value || "").trim();
  return singleValue ? [{ item: singleValue, units: "", checklist: {} }] : [];
}

function isHHMM(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function hasValidOptionalEventTimes(event) {
  return event.times.every(time => {
    const hasStart = Boolean(time.start);
    const hasEnd = Boolean(time.end);
    return (!hasStart && !hasEnd) || (isHHMM(time.start) && isHHMM(time.end));
  });
}

function normalizeEventList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(event => {
      const days = Math.max(1, Number.parseInt(event && event.days, 10) || 1);
      const times = Array.isArray(event && event.times) ? event.times : [];

      return {
        date: String(event && event.date ? event.date : "").trim(),
        title: String(event && event.title ? event.title : "").trim(),
        days,
        times: Array.from({ length: days }, (_, index) => ({
          start: String(times[index] && times[index].start ? times[index].start : "").trim(),
          end: String(times[index] && times[index].end ? times[index].end : "").trim()
        })),
        location: String(event && event.location ? event.location : "").trim(),
        company: eventCompanyOptions.includes(event && event.company) ? event.company : ""
      };
    })
    .filter(event =>
      /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
      event.title &&
      event.location &&
      event.company &&
      hasValidOptionalEventTimes(event)
    );
}

function parseSchedulePayload(rawValue) {
  const empty = {
    batchHijnx: [],
    batchSb: [],
    events: [],
    tasks: [],
    testPickups: [],
    processingTasks: []
  };

  if (!rawValue) return empty;

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
      return {
        batchHijnx: normalizeBatchList(parsed.batchHijnx),
        batchSb: normalizeBatchList(parsed.batchSb),
        events: normalizeEventList(parsed.events),
        tasks: Array.isArray(parsed.tasks)
          ? parsed.tasks
              .map(normalizeScheduleTask)
              .filter(task => task.text)
          : [],
        testPickups: normalizeTestPickups(parsed.testPickups),
        processingTasks: normalizeProcessingTasks(parsed.processingTasks)
      };
    }

    if (Array.isArray(parsed)) {
      return {
        ...empty,
        tasks: parsed
          .map(normalizeScheduleTask)
          .filter(task => task.text),
        testPickups: [],
        processingTasks: []
      };
    }
  } catch (err) {
    // Older saved calendar entries are plain newline-delimited text.
  }

  return {
    ...empty,
    tasks: String(rawValue)
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => ({ text: line, days: 1, totalHours: 0, assignments: [] })),
    testPickups: [],
    processingTasks: []
  };
}

function normalizeProcessingTasks(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (item && typeof item === "object") {
        return normalizeScheduleTask(item);
      }

      return {
        text: String(item || "").trim(),
        days: 1,
        totalHours: 0,
        assignments: []
      };
    })
    .filter(task => task.text);
}

function normalizeTestPickups(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(pickup => ({
      time: String(pickup && pickup.time ? pickup.time : "").trim(),
      items: Array.isArray(pickup && pickup.items)
        ? pickup.items.map(item => String(item || "").trim()).filter(Boolean)
        : []
    }))
    .filter(pickup => /^([01]\d|2[0-3]):[0-5]\d$/.test(pickup.time) && pickup.items.length);
}

function normalizeScheduleAssignments(value, days) {
  if (!Array.isArray(value)) return [];

  return value
    .map(assignment => ({
      dayIndex: Math.max(0, Number.parseInt(assignment && assignment.dayIndex, 10) || 0),
      employee: String(assignment && assignment.employee ? assignment.employee : "").trim(),
      hours: Math.max(0, Number.parseFloat(assignment && assignment.hours) || 0)
    }))
    .filter(assignment => assignment.dayIndex < days && assignment.employee && assignment.hours > 0);
}

function normalizeScheduleTask(task) {
  const text = String(task && task.text ? task.text : "").trim();
  const item = String(task && task.item ? task.item : "").trim();
  const units = Math.max(0, Number.parseFloat(task && task.units) || 0);
  const days = Math.max(1, Number.parseInt(task && task.days, 10) || 1);
  const totalHours = Math.max(0, Number.parseFloat(task && task.totalHours) || 0);
  const scheduleDate = isIsoDate(task && task.scheduleDate) ? task.scheduleDate : "";
  const sourceBatchKey = String(task && task.sourceBatchKey ? task.sourceBatchKey : "").trim();
  const sourceBatchLabel = String(task && task.sourceBatchLabel ? task.sourceBatchLabel : "").trim();
  const sourceTaskOrder = Number.parseInt(task && task.sourceTaskOrder, 10);
  const hoursOverridden = Boolean(task && task.hoursOverridden);
  const assignments = normalizeScheduleAssignments(task && task.assignments, days);
  const completedDates = Array.isArray(task && task.completedDates)
    ? task.completedDates.filter(isIsoDate)
    : [];
  const generatedTaskPlanned = Boolean(task && (
    task.generatedTaskPlanned ||
    totalHours > 0 ||
    assignments.length ||
    hoursOverridden
  ));

  return {
    text,
    item,
    units,
    scheduleDate,
    days,
    totalHours,
    assignments,
    sourceBatchKey,
    sourceBatchLabel,
    sourceTaskOrder: Number.isFinite(sourceTaskOrder) ? sourceTaskOrder : null,
    autoGenerated: Boolean(task && task.autoGenerated),
    hoursOverridden,
    generatedTaskPlanned,
    completedDates
  };
}

function getTaskDisplayText(task) {
  return task.item ? `${task.item} - ${task.text}` : task.text;
}

function getScheduleTasks(rawValue) {
  return parseSchedulePayload(rawValue).tasks;
}

function formatTaskHours(value) {
  const hours = Number.parseFloat(value);
  if (!Number.isFinite(hours)) return "0 hrs";
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 2 })} hr${rounded === 1 ? "" : "s"}`;
}

const batchTaskColors = [
  { background: "#eef5fb", border: "#2364aa", text: "#123c69" },
  { background: "#f1f8ea", border: "#5d9b45", text: "#24451c" },
  { background: "#fff5df", border: "#d08a1f", text: "#5a3a10" },
  { background: "#f5eefb", border: "#7a4fb0", text: "#3f285c" },
  { background: "#eef8f6", border: "#258579", text: "#174f48" },
  { background: "#fdeff2", border: "#c7556b", text: "#6c2635" }
];

function getBatchColorIndex(sourceBatchKey) {
  const key = String(sourceBatchKey || "");
  let total = 0;
  for (let index = 0; index < key.length; index += 1) {
    total = (total + key.charCodeAt(index) * (index + 1)) % batchTaskColors.length;
  }
  return total;
}

function getBatchColorKey(task) {
  if (!task) return "";
  const label = String(task.sourceBatchLabel || "").trim();
  if (label) return label;

  const key = String(task.sourceBatchKey || "").trim();
  const parts = key.split(":");
  if (parts.length >= 5) {
    return parts.slice(0, 3).join(":");
  }
  return key;
}

function applyBatchTaskColor(element, task) {
  if (!task || !task.sourceBatchKey) return;
  const color = batchTaskColors[getBatchColorIndex(getBatchColorKey(task))];
  element.classList.add("batch-colored-task");
  element.style.setProperty("--batch-task-bg", color.background);
  element.style.setProperty("--batch-task-border", color.border);
  element.style.setProperty("--batch-task-text", color.text);
  element.title = task.sourceBatchLabel || "";
}

function appendBatchList(container, payload) {
  const batches = [
    ...payload.batchHijnx.map(batch => ["Production Batch - Hijnx", batch]),
    ...payload.batchSb.map(batch => ["Production Batch - SB", batch])
  ];

  if (!batches.length) return;

  const batchList = document.createElement("div");
  batchList.className = "admin-batch-list";

  batches.forEach(([label, batch]) => {
    const item = document.createElement("div");
    item.className = "admin-batch-item";
    item.textContent = batch.units
      ? `${label}: ${batch.item} - ${batch.units} units - ${getBatchProgress(batch).percent}%`
      : `${label}: ${batch.item} - ${getBatchProgress(batch).percent}%`;
    batchList.appendChild(item);
  });

  container.appendChild(batchList);
}

function getBatchProgress(batch) {
  const checklist = batch.checklist || {};
  const completed = batchChecklistItems.filter(check => checklist[check.key]).length;
  return {
    completed,
    total: batchChecklistItems.length,
    percent: batchChecklistItems.length ? Math.round((completed / batchChecklistItems.length) * 100) : 0
  };
}

function getBatchStatusText(batch) {
  const progress = getBatchProgress(batch);
  if (progress.completed === 0) return "Not started";
  if (progress.completed === progress.total) return "Completed";
  return `${progress.percent}% complete`;
}

function isBatchInProgress(batch) {
  const progress = getBatchProgress(batch);
  return progress.completed < progress.total;
}

function getPayloadBatchesByKey(payload) {
  const batchesByKey = new Map();

  [
    ...payload.batchHijnx.map((batch, index) => ({ type: "hijnx", index, batch })),
    ...payload.batchSb.map((batch, index) => ({ type: "sb", index, batch }))
  ].forEach(({ type, index, batch }) => {
    batchesByKey.set(getGeneratedBatchKey(type, index, batch.item), batch);
  });

  return batchesByKey;
}

function taskWasCompletedOn(task, isoDate) {
  return (task.completedDates || []).includes(isoDate);
}

function taskWasCompleted(task) {
  return (task.completedDates || []).length > 0;
}

function appendBatchDetail(container, batch) {
  const item = document.createElement("div");
  item.className = "calendar-focus-item";

  const title = document.createElement("b");
  title.className = "calendar-focus-batch-name";
  title.textContent = batch.item || "Production batch";
  item.appendChild(title);

  const units = document.createElement("span");
  units.className = "calendar-focus-batch-units";
  units.textContent = batch.units ? `${batch.units} units` : "Units not set";
  item.appendChild(units);

  container.appendChild(item);
}

function appendEventList(container, events) {
  if (!events.length) return;

  const eventList = document.createElement("div");
  eventList.className = "admin-event-list";

  events.forEach(event => {
    const item = document.createElement("div");
    item.className = "admin-event-item";
    const timeText = event.start && event.end ? ` ${event.start}-${event.end}` : "";
    item.textContent = `${event.title}${timeText} - ${event.location} - ${event.company}`;
    eventList.appendChild(item);
  });

  container.appendChild(eventList);
}

function buildAdminEventsByDate(rows, visibleStart, visibleEnd) {
  const eventsByDate = new Map();
  const rangeStart = dateOnly(visibleStart);
  const rangeEnd = dateOnly(visibleEnd);

  rows.forEach(row => {
    const payload = parseSchedulePayload(row.tasks);
    payload.events.forEach(event => {
      const [year, month, day] = event.date.split("-").map(Number);
      const eventStart = new Date(year, month - 1, day);

      for (let index = 0; index < event.days; index += 1) {
        const eventDate = addDays(eventStart, index);
        if (eventDate < rangeStart || eventDate > rangeEnd) continue;

        const isoDate = toIsoDate(eventDate);
        if (!eventsByDate.has(isoDate)) {
          eventsByDate.set(isoDate, []);
        }

        const time = event.times[index] || { start: "", end: "" };
        eventsByDate.get(isoDate).push({
          title: event.title,
          start: time.start,
          end: time.end,
          location: event.location,
          company: event.company
        });
      }
    });
  });

  return eventsByDate;
}

function buildAdminProjectedTasksByDate(rows, visibleStart, visibleEnd, taskSelector = payload => payload.tasks) {
  const tasksByDate = new Map();
  const rangeStart = dateOnly(visibleStart);
  const rangeEnd = dateOnly(visibleEnd);
  const rangeStartIso = toIsoDate(rangeStart);
  const rangeEndIso = toIsoDate(rangeEnd);
  const todayIso = getTodayIsoDate();

  rows.forEach(row => {
    const [year, month, day] = row.schedule_date.split("-").map(Number);
    const rowStartDate = new Date(year, month - 1, day);
    const payload = parseSchedulePayload(row.tasks);
    const batchesByKey = getPayloadBatchesByKey(payload);

    const selectedTasks = taskSelector(payload);
    const taskType = selectedTasks === payload.processingTasks ? "processingTasks" : "tasks";

    selectedTasks.forEach((task, taskIndex) => {
      if (taskType === "processingTasks" && task.autoGenerated && task.sourceBatchKey) {
        const batch = batchesByKey.get(task.sourceBatchKey) || batchesByKey.get(getBatchColorKey(task));
        for (
          let activeDate = rangeStart;
          activeDate <= rangeEnd;
          activeDate = addDays(activeDate, 1)
        ) {
          const activeDateIso = toIsoDate(activeDate);
          if (activeDateIso < row.schedule_date) continue;

          const completedOnDate = taskWasCompletedOn(task, activeDateIso);
          const isPastDay = activeDateIso < todayIso;
          const shouldShow = isPastDay
            ? completedOnDate
            : completedOnDate || (batch && isBatchInProgress(batch) && !taskWasCompleted(task));

          if (!shouldShow) continue;
          if (!tasksByDate.has(activeDateIso)) {
            tasksByDate.set(activeDateIso, []);
          }
          tasksByDate.get(activeDateIso).push(createProjectedTask(task, row, taskType, taskIndex, activeDateIso, 0, {
            neededHours: task.totalHours,
            remainingHours: taskWasCompleted(task) ? 0 : task.totalHours
          }));
        }
        return;
      }

      let remainingHours = task.totalHours;
      const startDate = isIsoDate(task.scheduleDate)
        ? dateOnly(new Date(`${task.scheduleDate}T00:00:00`))
        : rowStartDate;
      const workDates = getProjectedWorkDates(startDate, task.days);

      workDates.forEach((activeDate, dayIndex) => {
        const dayAssignments = (task.assignments || [])
          .filter(assignment => assignment.dayIndex === dayIndex);
        const projectedTasks = [];

        if (task.totalHours > 0 && dayAssignments.length) {
          dayAssignments.forEach(assignment => {
            const appliedHours = Math.min(remainingHours, assignment.hours);
            remainingHours = Math.max(0, remainingHours - assignment.hours);
            if (appliedHours <= 0) return;

            projectedTasks.push({
              ...createProjectedTask(task, row, taskType, taskIndex, toIsoDate(activeDate), dayIndex),
              employee: assignment.employee,
              hours: appliedHours,
              remainingHours
            });
          });
        } else if (task.totalHours > 0) {
          projectedTasks.push(createProjectedTask(task, row, taskType, taskIndex, toIsoDate(activeDate), dayIndex, { remainingHours }));
        } else {
          projectedTasks.push(createProjectedTask(task, row, taskType, taskIndex, toIsoDate(activeDate), dayIndex));
        }

        if (activeDate < rangeStart || activeDate > rangeEnd) return;

        const isoDate = toIsoDate(activeDate);
        if (isoDate < rangeStartIso || isoDate > rangeEndIso) return;
        if (!tasksByDate.has(isoDate)) {
          tasksByDate.set(isoDate, []);
        }
        tasksByDate.get(isoDate).push(...projectedTasks);
      });
    });
  });

  return tasksByDate;
}

function getProcessingTasksWithGeneratedBatchFallback(payload, row) {
  const processingTasks = [...payload.processingTasks];
  const existingGeneratedKeys = new Set(
    processingTasks
      .filter(task => task.autoGenerated && task.sourceBatchKey)
      .map(task => `${task.sourceBatchKey}:${task.sourceTaskOrder}:${task.text}`)
  );

  [
    ...payload.batchHijnx.map((batch, index) => ({ type: "hijnx", index, batch })),
    ...payload.batchSb.map((batch, index) => ({ type: "sb", index, batch }))
  ].forEach(({ type, index, batch }) => {
    const template = getBatchTaskTemplate(batch.item);
    if (!template.length) return;

    const sourceBatchKey = getGeneratedBatchKey(type, index, batch.item);
    const sourceBatchLabel = `${type === "hijnx" ? "Hijnx" : "SB"} batch ${index + 1}: ${batch.item}`;
    const itemName = getBatchTaskItemName(batch.item);
    const units = Math.max(0, Number.parseFloat(batch.units) || 0);

    template.forEach(templateTask => {
      const generatedKey = `${sourceBatchKey}:${templateTask.order}:${templateTask.task}`;
      if (existingGeneratedKeys.has(generatedKey)) return;

      existingGeneratedKeys.add(generatedKey);
      processingTasks.push({
        item: itemName,
        text: templateTask.task,
        units,
        scheduleDate: row.schedule_date,
        totalHours: 0,
        days: 1,
        assignments: [],
        autoGenerated: true,
        sourceBatchKey,
        sourceBatchLabel,
        sourceTaskOrder: templateTask.order,
        hoursOverridden: false,
        generatedTaskPlanned: false,
        completedDates: []
      });
    });
  });

  return processingTasks;
}

function buildAdminActiveScheduleByDate(rows, visibleStart, visibleEnd) {
  const activeSchedule = new Map();
  const rangeStart = dateOnly(visibleStart);
  const rangeEnd = dateOnly(visibleEnd);
  const todayIso = getTodayIsoDate();

  for (let date = rangeStart; date <= rangeEnd; date = addDays(date, 1)) {
    activeSchedule.set(toIsoDate(date), {
      batchHijnx: [],
      batchSb: [],
      events: [],
      tasks: [],
      testPickups: [],
      processingTasks: []
    });
  }

  rows.forEach(row => {
    const [year, month, day] = row.schedule_date.split("-").map(Number);
    const rowStartDate = new Date(year, month - 1, day);
    const payload = parseSchedulePayload(row.tasks);
    const batchesByKey = getPayloadBatchesByKey(payload);

    if (activeSchedule.has(row.schedule_date)) {
      const scheduleDay = activeSchedule.get(row.schedule_date);
      scheduleDay.batchHijnx = payload.batchHijnx;
      scheduleDay.batchSb = payload.batchSb;
      scheduleDay.testPickups = payload.testPickups;
    }

    payload.events.forEach(event => {
      const [eventYear, eventMonth, eventDay] = event.date.split("-").map(Number);
      const eventStart = new Date(eventYear, eventMonth - 1, eventDay);

      for (let index = 0; index < event.days; index += 1) {
        const eventDate = addDays(eventStart, index);
        if (eventDate < rangeStart || eventDate > rangeEnd) continue;

        const isoDate = toIsoDate(eventDate);
        if (!activeSchedule.has(isoDate)) {
          activeSchedule.set(isoDate, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] });
        }

        const time = event.times[index] || { start: "", end: "" };
        activeSchedule.get(isoDate).events.push({
          title: event.title,
          start: time.start,
          end: time.end,
          location: event.location,
          company: event.company
        });
      }
    });

    [
      { tasks: payload.tasks, taskType: "tasks" },
      { tasks: getProcessingTasksWithGeneratedBatchFallback(payload, row), taskType: "processingTasks" }
    ].forEach(({ tasks, taskType }) => {
      tasks.forEach((task, taskIndex) => {
        if (taskType === "processingTasks" && task.autoGenerated && task.sourceBatchKey) {
          const batch = batchesByKey.get(task.sourceBatchKey) || batchesByKey.get(getBatchColorKey(task));
          for (
            let activeDate = rangeStart;
            activeDate <= rangeEnd;
            activeDate = addDays(activeDate, 1)
          ) {
            const activeDateIso = toIsoDate(activeDate);
            if (activeDateIso < row.schedule_date) continue;

            const completedOnDate = taskWasCompletedOn(task, activeDateIso);
            const isPastDay = activeDateIso < todayIso;
            const shouldShow = isPastDay
              ? completedOnDate
              : completedOnDate || (batch && isBatchInProgress(batch) && !taskWasCompleted(task));

            if (!shouldShow) continue;
            if (!activeSchedule.has(activeDateIso)) {
              activeSchedule.set(activeDateIso, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] });
            }
            activeSchedule.get(activeDateIso).processingTasks.push(createProjectedTask(task, row, taskType, taskIndex, activeDateIso, 0, {
              neededHours: task.totalHours,
              remainingHours: taskWasCompleted(task) ? 0 : task.totalHours
            }));
          }
          return;
        }

        let remainingHours = task.totalHours;
        const startDate = isIsoDate(task.scheduleDate)
          ? dateOnly(new Date(`${task.scheduleDate}T00:00:00`))
          : rowStartDate;
        const workDates = getProjectedWorkDates(startDate, task.days);

        workDates.forEach((activeDate, dayIndex) => {
          const dayAssignments = (task.assignments || [])
            .filter(assignment => assignment.dayIndex === dayIndex);
          const projectedTasks = [];

          if (task.totalHours > 0 && dayAssignments.length) {
            dayAssignments.forEach(assignment => {
              const appliedHours = Math.min(remainingHours, assignment.hours);
              remainingHours = Math.max(0, remainingHours - assignment.hours);
              if (appliedHours <= 0) return;

              projectedTasks.push({
                ...createProjectedTask(task, row, taskType, taskIndex, toIsoDate(activeDate), dayIndex),
                employee: assignment.employee,
                hours: appliedHours,
                remainingHours
              });
            });
          } else if (task.totalHours > 0) {
            projectedTasks.push(createProjectedTask(task, row, taskType, taskIndex, toIsoDate(activeDate), dayIndex, { remainingHours }));
          } else {
            projectedTasks.push(createProjectedTask(task, row, taskType, taskIndex, toIsoDate(activeDate), dayIndex));
          }

          if (activeDate < rangeStart || activeDate > rangeEnd) return;

          const isoDate = toIsoDate(activeDate);
          if (!activeSchedule.has(isoDate)) {
            activeSchedule.set(isoDate, { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] });
          }
          activeSchedule.get(isoDate)[taskType].push(...projectedTasks);
        });
      });
    });
  });

  return activeSchedule;
}

function appendTestPickupList(container, payload) {
  if (!payload.testPickups.length) return;

  const pickupList = document.createElement("div");
  pickupList.className = "admin-test-pickup-list";

  payload.testPickups.forEach(pickup => {
    const item = document.createElement("div");
    item.className = "admin-test-pickup";
    item.textContent = `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`;
    pickupList.appendChild(item);
  });

  container.appendChild(pickupList);
}

function appendProcessingTaskList(container, processingTasks, className = "calendar-processing-tasks") {
  if (!processingTasks.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = className;

  const heading = document.createElement("div");
  heading.className = "calendar-processing-heading";
  heading.textContent = "Processing Tasks";
  wrapper.appendChild(heading);

  const list = document.createElement("ol");
  list.className = "calendar-processing-task-list";

  groupDailyTaskAssignments(processingTasks).forEach(task => {
    const item = document.createElement("li");
    item.className = "calendar-processing-task";
    applyBatchTaskColor(item, task);
    item.textContent = task.assignedHours > 0
      ? `${getTaskDisplayText(task)} - ${formatTaskHours(task.assignedHours)}`
      : task.legacyDays > 1
        ? `${getTaskDisplayText(task)} - ${task.legacyDays} days`
        : getTaskDisplayText(task);
    list.appendChild(item);
  });

  wrapper.appendChild(list);
  container.appendChild(wrapper);
}

function buildAdminExpectedDeliveriesByDate(items, visibleStart, visibleEnd) {
  const deliveriesByDate = new Map();
  const rangeStartIso = toIsoDate(visibleStart);
  const rangeEndIso = toIsoDate(visibleEnd);

  items.forEach(item => {
    const isReceived = Boolean(item.received_date);
    const deliveryDate = isReceived ? item.received_date : item.expected_delivery_date;
    if (!deliveryDate || Number(item.import_needs_delivery_date)) return;
    if (deliveryDate < rangeStartIso || deliveryDate > rangeEndIso) return;

    if (!deliveriesByDate.has(deliveryDate)) {
      deliveriesByDate.set(deliveryDate, []);
    }

    deliveriesByDate.get(deliveryDate).push({
      ...item,
      calendar_delivery_status: isReceived ? "Delivered" : "Expected"
    });
  });

  return deliveriesByDate;
}

function appendAdminExpectedDeliveries(container, deliveries) {
  if (!deliveries.length) return;

  const section = document.createElement("div");
  section.className = "admin-calendar-deliveries";

  const groups = [
    ["Expected", deliveries.filter(delivery => delivery.calendar_delivery_status !== "Delivered")],
    ["Delivered", deliveries.filter(delivery => delivery.calendar_delivery_status === "Delivered")]
  ];

  groups.forEach(([label, group]) => {
    if (!group.length) return;

    const heading = document.createElement("div");
    heading.className = "admin-calendar-delivery-heading";
    heading.textContent = `${label} Deliveries`;
    section.appendChild(heading);

    group.forEach(delivery => {
      const item = document.createElement("div");
      item.className = "admin-calendar-delivery";
      item.textContent = `${delivery.item_name} - QTY ${delivery.package_qty}`;
      section.appendChild(item);
    });
  });

  container.appendChild(section);
}

function getBatchRows(type) {
  return document.getElementById(type === "hijnx" ? "batchHijnxRows" : "batchSbRows");
}

function getBatchTaskItemName(batchItem) {
  return productionBatchItemAliases[batchItem] || batchItem;
}

function getAssignedBatchTaskTemplate(itemName) {
  const itemId = getItemIdByName(itemName);
  if (!itemId) return [];

  return (itemTaskOptionsByItemId[itemId] || [])
    .map((taskId, index) => ({
      order: index + 1,
      task: getTaskNameById(taskId)
    }))
    .filter(templateTask => templateTask.task);
}

function getBatchTaskTemplate(batchItem) {
  const itemName = getBatchTaskItemName(batchItem);
  return batchTaskTemplatesByItem[itemName] || getAssignedBatchTaskTemplate(itemName);
}

function getGeneratedBatchKey(batchType, batchIndex, batchItem) {
  return `${batchType}:${batchIndex}:${batchItem}`;
}

function getGeneratedBatchTaskKey(batchType, batchIndex, batchItem, order, task) {
  return `${getGeneratedBatchKey(batchType, batchIndex, batchItem)}:${order}:${task}`;
}

function getGeneratedTaskIdentityKey(task) {
  const baseKey = getBatchColorKey(task);
  return `${baseKey}:${task.sourceTaskOrder}:${task.text}`;
}

function getGeneratedProcessingTaskMap() {
  return new Map(
    getProcessingTaskValues()
      .filter(task => task.autoGenerated && task.sourceBatchKey)
      .flatMap(task => [
        [`${task.sourceBatchKey}:${task.sourceTaskOrder}:${task.text}`, task],
        [getGeneratedTaskIdentityKey(task), task]
      ])
  );
}

function getGeneratedProcessingRows() {
  return Array.from(document.querySelectorAll("#processingTaskRows .schedule-task-row.batch-generated-task"));
}

function markGeneratedTaskPlanned(row) {
  if (row && row.dataset.autoGenerated === "true") {
    row.dataset.generatedTaskPlanned = "true";
  }
}

function getFirstPlannerAssignment(row) {
  return row.querySelector(".schedule-assignment-row");
}

function ensurePlannerAssignment(row) {
  let assignment = getFirstPlannerAssignment(row);
  if (!assignment) {
    addScheduleAssignment(row, {
      dayIndex: 0,
      employee: "Open",
      hours: Number.parseFloat(row.querySelector(".schedule-task-hours").value) || 0
    });
    assignment = getFirstPlannerAssignment(row);
  }
  return assignment;
}

function setPlannerAssignment(row, employeeValue, hoursValue) {
  markGeneratedTaskPlanned(row);
  const assignment = ensurePlannerAssignment(row);
  assignment.querySelector(".schedule-assignment-day").value = "0";
  assignment.querySelector(".schedule-assignment-employee").value = employeeValue;
  assignment.querySelector(".schedule-assignment-hours").value = hoursValue;
  updateScheduleTaskRemaining(row);
}

function createBatchPlannerField(labelText, control) {
  const field = document.createElement("div");
  field.className = "batch-plan-field";

  const label = document.createElement("label");
  label.textContent = labelText;
  field.appendChild(label);
  field.appendChild(control);

  return field;
}

function renderBatchTaskPlanner() {
  const planner = document.getElementById("batchTaskPlanner");
  if (!planner) return;

  const generatedRows = getGeneratedProcessingRows();
  planner.innerHTML = "";
  planner.hidden = !generatedRows.length;
  if (!generatedRows.length) return;

  const rowsByBatch = new Map();
  generatedRows.forEach(row => {
    const batchLabel = row.dataset.sourceBatchLabel || "Generated batch";
    if (!rowsByBatch.has(batchLabel)) rowsByBatch.set(batchLabel, []);
    rowsByBatch.get(batchLabel).push(row);
  });

  rowsByBatch.forEach((rows, batchLabel) => {
    rows.sort((a, b) =>
      (Number.parseInt(a.dataset.sourceTaskOrder, 10) || 0) - (Number.parseInt(b.dataset.sourceTaskOrder, 10) || 0)
    );

    const card = document.createElement("section");
    card.className = "batch-plan-card";

    const heading = document.createElement("h5");
    heading.textContent = batchLabel;
    card.appendChild(heading);

    rows.forEach(row => {
      const taskLine = document.createElement("div");
      taskLine.className = "batch-plan-task";

      const itemName = row.querySelector(".schedule-task-item").value;
      const taskName = row.querySelector(".schedule-task-input").value;
      const units = Number.parseFloat(row.querySelector(".schedule-task-units").value) || 0;
      const assignment = getFirstPlannerAssignment(row);

      const title = document.createElement("div");
      title.className = "batch-plan-task-title";
      const taskLabel = document.createElement("b");
      taskLabel.textContent = taskName || "Generated task";
      title.appendChild(taskLabel);
      const taskMeta = document.createElement("span");
      taskMeta.textContent = `${itemName || "No item"}${units ? ` - ${units.toLocaleString()} units` : ""}`;
      title.appendChild(taskMeta);
      taskLine.appendChild(title);

      const hoursInput = document.createElement("input");
      hoursInput.type = "number";
      hoursInput.min = "0";
      hoursInput.step = "0.25";
      hoursInput.value = row.querySelector(".schedule-task-hours").value || "";
      hoursInput.addEventListener("input", () => {
        row.querySelector(".schedule-task-hours").value = hoursInput.value;
        row.dataset.hoursOverridden = "true";
        markGeneratedTaskPlanned(row);
        const currentAssignment = getFirstPlannerAssignment(row);
        if (currentAssignment) {
          currentAssignment.querySelector(".schedule-assignment-hours").value = hoursInput.value;
        }
        updateScheduleTaskRemaining(row);
      });
      taskLine.appendChild(createBatchPlannerField("Hours", hoursInput));

      const employeeInput = createEmployeeInput(assignment ? assignment.querySelector(".schedule-assignment-employee").value : "Open");
      employeeInput.addEventListener("input", () => {
        const assignedHours = row.querySelector(".schedule-task-hours").value || "";
        markGeneratedTaskPlanned(row);
        setPlannerAssignment(row, employeeInput.value, assignedHours);
      });
      taskLine.appendChild(createBatchPlannerField("Person", employeeInput));

      const detailButton = document.createElement("button");
      detailButton.type = "button";
      detailButton.textContent = row.classList.contains("batch-planner-detail-open") ? "Hide Details" : "Details";
      detailButton.addEventListener("click", () => {
        row.classList.toggle("batch-planner-detail-open");
        detailButton.textContent = row.classList.contains("batch-planner-detail-open") ? "Hide Details" : "Details";
      });
      taskLine.appendChild(detailButton);

      card.appendChild(taskLine);
    });

    planner.appendChild(card);
  });
}

function refreshBatchRows(type) {
  getBatchRows(type).querySelectorAll(".batch-row").forEach((row, index) => {
    row.querySelector(".batch-order").textContent = `${index + 1}.`;
  });
}

function addBatchEntry(type, value = "", unitsValue = "") {
  const rows = getBatchRows(type);
  const row = document.createElement("div");
  row.className = "batch-row";

  const batchValue = value && typeof value === "object" ? value.item : value;
  const batchUnits = value && typeof value === "object" ? value.units : unitsValue;
  const batchChecklist = value && typeof value === "object" && value.checklist ? value.checklist : {};

  const order = document.createElement("span");
  order.className = "batch-order";
  row.appendChild(order);

  const input = document.createElement("select");
  input.className = "batch-input";

  const options = getProductionBatchOptions(type);
  const blankOption = document.createElement("option");
  blankOption.value = "";
  blankOption.text = type === "hijnx" ? "Select Hijnx batch" : "Select SB batch";
  input.appendChild(blankOption);

  options.forEach(optionValue => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.text = optionValue;
    input.appendChild(option);
  });

  if (batchValue && !options.includes(batchValue)) {
    const existingOption = document.createElement("option");
    existingOption.value = batchValue;
    existingOption.text = batchValue;
    input.appendChild(existingOption);
  }

  input.value = batchValue;
  input.addEventListener("change", syncGeneratedBatchTasksFromBatches);
  row.appendChild(input);

  const units = document.createElement("input");
  units.type = "number";
  units.className = "batch-units";
  units.min = "0";
  units.step = "1";
  units.placeholder = "Units";
  units.value = batchUnits;
  units.addEventListener("input", syncGeneratedBatchTasksFromBatches);
  row.appendChild(units);

  const checklist = document.createElement("div");
  checklist.className = "batch-checklist";
  batchChecklistItems.forEach(check => {
    const label = document.createElement("label");
    label.className = "batch-checklist-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "batch-checklist-input";
    checkbox.dataset.checkKey = check.key;
    checkbox.checked = Boolean(batchChecklist[check.key]);

    label.appendChild(checkbox);
    label.append(document.createTextNode(check.label));
    checklist.appendChild(label);
  });
  row.appendChild(checklist);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!rows.children.length) {
      addBatchEntry(type);
      syncGeneratedBatchTasksFromBatches();
      return;
    }
    refreshBatchRows(type);
    syncGeneratedBatchTasksFromBatches();
  });
  row.appendChild(removeButton);

  rows.appendChild(row);
  refreshBatchRows(type);
  return input;
}

function populateBatchRows(type, values) {
  const rows = getBatchRows(type);
  rows.innerHTML = "";

  if (!values.length) {
    addBatchEntry(type);
    return;
  }

  values.forEach(value => addBatchEntry(type, value));
}

function getBatchValues(type) {
  return Array.from(getBatchRows(type).querySelectorAll(".batch-row"))
    .map(row => ({
      item: row.querySelector(".batch-input").value.trim(),
      units: row.querySelector(".batch-units").value.trim(),
      checklist: Object.fromEntries(
        Array.from(row.querySelectorAll(".batch-checklist-input"))
          .map(input => [input.dataset.checkKey, input.checked])
      )
    }))
    .filter(batch => batch.item);
}

function syncGeneratedBatchTasksFromBatches() {
  const processingRows = document.getElementById("processingTaskRows");
  if (!processingRows) return;

  const existingGeneratedTasks = getGeneratedProcessingTaskMap();
  processingRows.querySelectorAll(".schedule-task-row.batch-generated-task").forEach(row => row.remove());

  const batchRows = [
    ...Array.from(getBatchRows("hijnx").querySelectorAll(".batch-row")).map((row, index) => ({ type: "hijnx", index, row })),
    ...Array.from(getBatchRows("sb").querySelectorAll(".batch-row")).map((row, index) => ({ type: "sb", index, row }))
  ];

  batchRows.forEach(({ type, index, row }) => {
    const batchItem = row.querySelector(".batch-input").value.trim();
    const batchUnits = Math.max(0, Number.parseFloat(row.querySelector(".batch-units").value) || 0);
    if (!batchItem) return;

    const itemName = getBatchTaskItemName(batchItem);
    const template = getBatchTaskTemplate(batchItem);
    if (!template.length) return;

    const sourceBatchLabel = `${type === "hijnx" ? "Hijnx" : "SB"} batch ${index + 1}: ${batchItem}`;

    template
      .slice()
      .sort((a, b) => a.order - b.order || a.task.localeCompare(b.task))
      .forEach(templateTask => {
        const sourceBatchKey = getGeneratedBatchKey(type, index, batchItem);
        const existingKey = `${sourceBatchKey}:${templateTask.order}:${templateTask.task}`;
        const legacySourceBatchKey = getGeneratedBatchTaskKey(type, index, batchItem, templateTask.order, templateTask.task);
        const legacyExistingKey = `${legacySourceBatchKey}:${templateTask.order}:${templateTask.task}`;
        const existingTask = existingGeneratedTasks.get(existingKey) || existingGeneratedTasks.get(legacyExistingKey);
        const generatedTaskPlanned = Boolean(existingTask && (
          existingTask.totalHours > 0 ||
          (existingTask.assignments || []).length ||
          existingTask.hoursOverridden
        ));
        const preserveHours = Boolean(existingTask && generatedTaskPlanned);
        const taskValue = {
          item: itemName,
          text: templateTask.task,
          units: batchUnits,
          scheduleDate: existingTask && existingTask.scheduleDate
            ? existingTask.scheduleDate
            : document.getElementById("schedule_edit_date").value || "",
          totalHours: preserveHours ? existingTask.totalHours : 0,
          days: existingTask ? existingTask.days : 1,
          assignments: existingTask ? existingTask.assignments : [],
          autoGenerated: true,
          sourceBatchKey,
          sourceBatchLabel,
          sourceTaskOrder: templateTask.order,
          hoursOverridden: Boolean(preserveHours),
          generatedTaskPlanned,
          completedDates: existingTask ? existingTask.completedDates : []
        };
        const taskSelect = addScheduleTask(taskValue, taskValue.days, "processingTaskRows");
        const taskRow = taskSelect.closest(".schedule-task-row");
        if (taskRow && !preserveHours) {
          autoFillScheduleTaskHours(taskRow, true);
        }
      });
  });

  renderBatchTaskPlanner();
}

function refreshEventRows() {
  document.querySelectorAll(".event-row").forEach((row, index) => {
    const label = row.querySelector(".event-row-number");
    if (label) label.textContent = `Event ${index + 1}`;
  });
}

function setupHHMMInput(input) {
  input.inputMode = "numeric";
  input.maxLength = 5;
  input.pattern = "([01]\\d|2[0-3]):[0-5]\\d";
  input.placeholder = "00:00";
  input.title = "Enter time as HH:MM";
  input.addEventListener("input", () => {
    input.value = input.value
      .replace(/[^\d:]/g, "")
      .replace(/^(\d{2})(\d)/, "$1:$2")
      .slice(0, 5);
  });
  input.addEventListener("blur", () => {
    input.value = normalizeHHMMInput(input.value);
  });
}

function normalizeHHMMInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const digits = text.replace(/\D/g, "");

  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hour, minute] = text.split(":");
    return `${hour.padStart(2, "0")}:${minute}`;
  }

  if (/^\d{3,4}$/.test(digits)) {
    const padded = digits.padStart(4, "0");
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
  }

  return text;
}

function renderEventTimeRows(row, times = []) {
  const container = row.querySelector(".event-day-times");
  const days = Math.max(1, Number.parseInt(row.querySelector(".event-days").value, 10) || 1);
  container.innerHTML = "";

  for (let index = 0; index < days; index += 1) {
    const time = times[index] || {};
    const timeRow = document.createElement("div");
    timeRow.className = "event-day-time-row";

    const label = document.createElement("span");
    label.textContent = `Day ${index + 1}`;
    timeRow.appendChild(label);

    const start = document.createElement("input");
    start.type = "text";
    start.className = "event-start-time";
    start.value = time.start || "";
    setupHHMMInput(start);
    timeRow.appendChild(start);

    const end = document.createElement("input");
    end.type = "text";
    end.className = "event-end-time";
    end.value = time.end || "";
    setupHHMMInput(end);
    timeRow.appendChild(end);

    container.appendChild(timeRow);
  }
}

function addEventEntry(value = {}) {
  const rows = document.getElementById("eventRows");
  const row = document.createElement("div");
  row.className = "event-row";

  const heading = document.createElement("b");
  heading.className = "event-row-number";
  row.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "event-row-grid";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "event-date";
  dateInput.value = value.date || document.getElementById("schedule_edit_date").value || toIsoDate(new Date());
  grid.appendChild(createOrderField("Date", dateInput));

  const title = document.createElement("input");
  title.type = "text";
  title.className = "event-title";
  title.value = value.title || "";
  grid.appendChild(createOrderField("Event Title", title));

  const days = document.createElement("input");
  days.type = "number";
  days.className = "event-days";
  days.min = "1";
  days.step = "1";
  days.value = String(Math.max(1, Number.parseInt(value.days, 10) || 1));
  days.addEventListener("input", () => renderEventTimeRows(row, getEventTimesFromRow(row)));
  grid.appendChild(createOrderField("Length of Days", days));

  const location = document.createElement("input");
  location.type = "text";
  location.className = "event-location";
  location.value = value.location || "";
  grid.appendChild(createOrderField("Location", location));

  const company = document.createElement("select");
  company.className = "event-company";
  const blankOption = document.createElement("option");
  blankOption.value = "";
  blankOption.text = "Company Participating";
  company.appendChild(blankOption);
  eventCompanyOptions.forEach(optionValue => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.text = optionValue;
    company.appendChild(option);
  });
  company.value = value.company || "";
  grid.appendChild(createOrderField("Company Participating", company));

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    refreshEventRows();
  });
  grid.appendChild(removeButton);

  row.appendChild(grid);

  const timeContainer = document.createElement("div");
  timeContainer.className = "event-day-times";
  row.appendChild(timeContainer);

  rows.appendChild(row);
  renderEventTimeRows(row, value.times || []);
  refreshEventRows();
  return title;
}

function populateEventRows(events) {
  const rows = document.getElementById("eventRows");
  rows.innerHTML = "";
  events.forEach(event => addEventEntry(event));
}

function getEventTimesFromRow(row) {
  return Array.from(row.querySelectorAll(".event-day-time-row")).map(timeRow => ({
    start: normalizeHHMMInput(timeRow.querySelector(".event-start-time").value),
    end: normalizeHHMMInput(timeRow.querySelector(".event-end-time").value)
  }));
}

function getEventValues() {
  return Array.from(document.querySelectorAll(".event-row"))
    .map(row => ({
      date: row.querySelector(".event-date").value,
      title: row.querySelector(".event-title").value.trim(),
      days: Math.max(1, Number.parseInt(row.querySelector(".event-days").value, 10) || 1),
      times: getEventTimesFromRow(row),
      location: row.querySelector(".event-location").value.trim(),
      company: row.querySelector(".event-company").value
    }))
    .filter(event => event.title || event.location || event.company || event.times.some(time => time.start || time.end));
}

function validateEvents(events) {
  const invalid = events.find(event =>
    !event.date ||
    !event.title ||
    !event.location ||
    !event.company ||
    event.times.length !== event.days ||
    !hasValidOptionalEventTimes(event)
  );

  if (invalid) {
    throw new Error("Each Event needs a date, title, location, company, and valid HH:MM start/end times when times are entered.");
  }
}

function appendOrderedTaskList(container, tasks, className) {
  const lines = Array.isArray(tasks) ? tasks : getScheduleTasks(tasks);
  if (!lines.length) return;

  const list = document.createElement("ol");
  list.className = className;

  lines.forEach(task => {
    const item = document.createElement("li");
    applyBatchTaskColor(item, task);
    const parts = [getTaskDisplayText(task)];
    if (task.employee && task.hours) {
      parts.push(`${task.employee}: ${formatTaskHours(task.hours)}`);
    } else if (task.totalHours) {
      parts.push(`${formatTaskHours(task.remainingHours)} remaining`);
    } else if (task.days > 1) {
      parts.push(`${task.days} days`);
    }
    if (task.employee && Number.isFinite(task.remainingHours)) {
      parts.push(`${formatTaskHours(task.remainingHours)} left`);
    }
    item.textContent = parts.join(" - ");
    list.appendChild(item);
  });

  container.appendChild(list);
}

function groupDailyTaskAssignments(tasks) {
  const groups = new Map();

  tasks.forEach(task => {
    const key = `${task.taskType || ""}\n${task.sourceScheduleDate || ""}\n${task.sourceTaskIndex ?? ""}\n${task.sourceBatchKey || ""}\n${task.item || ""}\n${task.text}`;
    if (!groups.has(key)) {
      groups.set(key, {
        item: task.item || "",
        text: task.text,
        taskType: task.taskType || "tasks",
        sourceScheduleDate: task.sourceScheduleDate || "",
        sourceTaskIndex: Number.isInteger(task.sourceTaskIndex) ? task.sourceTaskIndex : null,
        activeDate: task.activeDate || "",
        sourceBatchKey: task.sourceBatchKey || "",
        sourceBatchLabel: task.sourceBatchLabel || "",
        assignedHours: 0,
        neededHours: 0,
        remainingHours: task.remainingHours,
        people: new Map(),
        legacyDays: task.days || 1,
        completed: Boolean(task.completed),
        taskCount: 0,
        completedCount: 0
      });
    }

    const group = groups.get(key);
    group.taskCount += 1;
    if (task.completed) group.completedCount += 1;
    group.completed = group.completedCount === group.taskCount;
    if (task.hours) {
      group.assignedHours += task.hours;
    }
    if (task.neededHours) {
      group.neededHours += task.neededHours;
    }
    if (Number.isFinite(task.remainingHours)) {
      group.remainingHours = task.remainingHours;
    }
    if (task.employee && task.hours) {
      group.people.set(task.employee, (group.people.get(task.employee) || 0) + task.hours);
    }
  });

  return Array.from(groups.values());
}

function createProjectedTask(task, row, taskType, taskIndex, activeDate, dayIndex, overrides = {}) {
  return {
    item: task.item,
    text: task.text,
    days: task.days,
    totalHours: task.totalHours,
    neededHours: task.totalHours,
    units: task.units,
    scheduleDate: task.scheduleDate,
    sourceBatchKey: task.sourceBatchKey,
    sourceBatchLabel: task.sourceBatchLabel,
    sourceTaskOrder: task.sourceTaskOrder,
    sourceScheduleDate: row.schedule_date,
    sourceTaskIndex: taskIndex,
    taskType,
    activeDate,
    dayIndex,
    completed: (task.completedDates || []).includes(activeDate),
    ...overrides
  };
}

async function toggleScheduleTaskCompletion(task, completed, checkbox) {
  if (!task.sourceScheduleDate || !task.activeDate || !Number.isInteger(task.sourceTaskIndex)) return;

  checkbox.disabled = true;
  const previous = !completed;

  try {
    const res = await adminFetch("/schedule/task-completion", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceDate: task.sourceScheduleDate,
        activeDate: task.activeDate,
        taskType: task.taskType || "tasks",
        taskIndex: task.sourceTaskIndex,
        task: {
          item: task.item,
          text: task.text,
          units: task.units,
          scheduleDate: task.scheduleDate || task.sourceScheduleDate,
          totalHours: task.totalHours,
          days: task.days,
          assignments: [],
          autoGenerated: Boolean(task.sourceBatchKey),
          sourceBatchKey: task.sourceBatchKey,
          sourceBatchLabel: task.sourceBatchLabel,
          sourceTaskOrder: task.sourceTaskOrder,
          completedDates: []
        },
        completed
      })
    });

    if (!res.ok) throw new Error(await res.text());
    await loadAdminCalendar();
  } catch (err) {
    checkbox.checked = previous;
    checkbox.closest(".calendar-focus-item")?.classList.toggle("task-completed", previous);
    showMessage(err.message || "Could not update task completion.", "error");
  } finally {
    checkbox.disabled = false;
  }
}

function appendTaskCompletionControl(item, task) {
  if (!task.sourceScheduleDate || !task.activeDate || !Number.isInteger(task.sourceTaskIndex)) return;

  const label = document.createElement("label");
  label.className = "task-completion-control";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(task.completed);
  checkbox.addEventListener("change", () => {
    item.classList.toggle("task-completed", checkbox.checked);
    toggleScheduleTaskCompletion(task, checkbox.checked, checkbox);
  });

  label.appendChild(checkbox);
  label.append(document.createTextNode("Completed"));
  item.appendChild(label);
  item.classList.toggle("task-completed", checkbox.checked);
}

function appendCalendarTaskSummary(container, tasks, className) {
  const lines = Array.isArray(tasks) ? tasks : getScheduleTasks(tasks);
  if (!lines.length) return;

  const heading = document.createElement("div");
  heading.className = "calendar-kitchen-heading";
  heading.textContent = "Kitchen Tasks";
  container.appendChild(heading);

  const list = document.createElement("ol");
  list.className = className;

  groupDailyTaskAssignments(lines).forEach(task => {
    const item = document.createElement("li");
    applyBatchTaskColor(item, task);
    item.textContent = task.assignedHours > 0
      ? `${getTaskDisplayText(task)} - ${formatTaskHours(task.assignedHours)}`
      : task.neededHours > 0
        ? `${getTaskDisplayText(task)} - ${formatTaskHours(task.neededHours)} needed`
      : task.legacyDays > 1
        ? `${getTaskDisplayText(task)} - ${task.legacyDays} days`
        : getTaskDisplayText(task);
    list.appendChild(item);
  });

  container.appendChild(list);
}

function renderAdminFocusedDay(isoDate, payload, projectedTasks, projectedProcessingTasks, deliveries, events) {
  const panel = document.getElementById("adminCalendarDayFocus");
  const title = document.getElementById("adminCalendarDayFocusTitle");
  const body = document.getElementById("adminCalendarDayFocusBody");
  if (!panel || !title || !body) return;

  title.textContent = formatDisplayDate(isoDate);
  body.innerHTML = "";

  const section = (headingText, fill, className) => {
    const block = document.createElement("div");
    block.className = `calendar-focus-section ${className}`;
    const heading = document.createElement("h4");
    heading.textContent = headingText;
    block.appendChild(heading);
    fill(block);
    body.appendChild(block);
  };

  section("Events", block => appendFocusLines(block, events, event => {
    const timeText = event.start && event.end ? ` ${event.start}-${event.end}` : "";
    return `${event.title}${timeText} - ${event.location} - ${event.company}`;
  }, "No events scheduled."), "focus-events");

  section("Production Batches", block => {
    const batches = [
      ...payload.batchHijnx.map(batch => ({ label: "Hijnx", ...batch })),
      ...payload.batchSb.map(batch => ({ label: "SB", ...batch }))
    ];
    if (!batches.length) {
      block.appendChild(createFocusEmpty("No production batches."));
      return;
    }
    batches.forEach(batch => appendBatchDetail(block, batch));
  }, "focus-batches");

  section("Kitchen Tasks", block => appendTaskFocusDetails(block, projectedTasks, "No kitchen tasks scheduled."), "focus-kitchen");

  section("Deliveries", block => appendFocusLines(block, deliveries, delivery =>
    `${delivery.calendar_delivery_status}: ${delivery.item_name} - QTY ${delivery.package_qty || ""}`.trim(),
  "No deliveries."), "focus-deliveries");

  section("Test Pick Ups", block => appendFocusLines(block, payload.testPickups, pickup =>
    `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`,
  "No test pick ups."), "focus-pickups");

  section("Processing Tasks", block => appendTaskFocusDetails(block, projectedProcessingTasks, "No processing tasks."), "focus-processing");

  panel.hidden = false;
  const closeButton = panel.querySelector("button");
  if (closeButton) closeButton.focus();
}

function renderAdminFocusedScheduleDay(isoDate, scheduleDay, deliveries) {
  renderAdminFocusedDay(
    isoDate,
    scheduleDay,
    scheduleDay.tasks || [],
    scheduleDay.processingTasks || [],
    deliveries,
    scheduleDay.events || []
  );
}

function closeAdminCalendarDayFocus() {
  const panel = document.getElementById("adminCalendarDayFocus");
  const body = document.getElementById("adminCalendarDayFocusBody");
  if (!panel) return;

  panel.hidden = true;
  if (body) body.innerHTML = "";
}

function createFocusEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "calendar-focus-empty";
  empty.textContent = text;
  return empty;
}

function appendFocusLines(container, lines, formatLine, emptyText) {
  if (!lines.length) {
    container.appendChild(createFocusEmpty(emptyText));
    return;
  }

  lines.forEach(line => {
    const item = document.createElement("div");
    item.className = "calendar-focus-item";
    item.textContent = formatLine(line);
    container.appendChild(item);
  });
}

function appendTaskFocusDetails(block, projectedTasks, emptyText) {
  const groups = groupDailyTaskAssignments(projectedTasks);
  if (!groups.length) {
    block.appendChild(createFocusEmpty(emptyText));
    return;
  }

  groups.forEach(task => {
    const item = document.createElement("div");
    item.className = "calendar-focus-item";
    applyBatchTaskColor(item, task);
    const titleLine = document.createElement("b");
    titleLine.className = "calendar-task-title";
    const hoursText = task.assignedHours > 0
      ? `${formatTaskHours(task.assignedHours)} assigned`
      : Number.isFinite(task.neededHours)
        ? `${formatTaskHours(task.neededHours)} needed`
        : "No hours assigned";
    titleLine.textContent = `${getTaskDisplayText(task)} - ${hoursText}`;
    item.appendChild(titleLine);
    appendTaskCompletionControl(item, task);

    if (task.people.size) {
      const people = document.createElement("div");
      people.textContent = `${task.people.size} person${task.people.size === 1 ? "" : "s"} assigned`;
      item.appendChild(people);

      const list = document.createElement("ul");
      task.people.forEach((hours, employee) => {
        const person = document.createElement("li");
        person.textContent = `${employee}: ${formatTaskHours(hours)}`;
        list.appendChild(person);
      });
      item.appendChild(list);
    } else if (!task.neededHours) {
      item.appendChild(createFocusEmpty("No person hours assigned for this day."));
    }

    if (Number.isFinite(task.remainingHours)) {
      const remaining = document.createElement("div");
      remaining.textContent = `${formatTaskHours(task.remainingHours)} remaining after this day`;
      item.appendChild(remaining);
    }

    block.appendChild(item);
  });
}

function showAdminTab(tabName) {
  document.getElementById("entriesPanel").classList.toggle("active", tabName === "entries");
  document.getElementById("reviewPanel").classList.toggle("active", tabName === "review");
  document.getElementById("itemTaskManagementPanel").classList.toggle("active", tabName === "itemTasks");
  document.getElementById("dailyPanel").classList.toggle("active", tabName === "daily");
  document.getElementById("batchTrackerPanel").classList.toggle("active", tabName === "batches");
  document.getElementById("calendarPanel").classList.toggle("active", tabName === "calendar");
  document.getElementById("orderedPanel").classList.toggle("active", tabName === "ordered");

  document.querySelectorAll(".admin-tab-button").forEach(button => {
    const isActive =
      (tabName === "entries" && button.textContent === "Entries") ||
      (tabName === "review" && button.textContent === "Entries for Review") ||
      (tabName === "itemTasks" && button.textContent === "Item & Task Management") ||
      (tabName === "daily" && button.textContent === "Daily Report") ||
      (tabName === "batches" && button.textContent === "Batch Tracker") ||
      (tabName === "calendar" && button.textContent === "Calendar") ||
      (tabName === "ordered" && button.textContent === "Ordered Items");
    button.classList.toggle("active", isActive);
  });

  showMessage("");

  if (tabName === "calendar") {
    loadAdminCalendar();
  }

  if (tabName === "daily") {
    loadDailyReport();
  }

  if (tabName === "review") {
    loadFlaggedEntryReview();
  }

  if (tabName === "itemTasks") {
    loadItemTaskManagement();
  }

  if (tabName === "batches") {
    loadBatchTracker();
  }

  if (tabName === "ordered") {
    loadOrderedAdminData();
  }
}

async function loadReport() {
  const entriesRes = await adminFetch("/admin/entries");
  if (!entriesRes.ok) {
    const text = await entriesRes.text();
    showMessage("Entries load failed: " + text, "error");
    return;
  }

  const data = await entriesRes.json();

  const from = document.getElementById("from_date").value;
  const to = document.getElementById("to_date").value;
  const emp = document.getElementById("employee_filter").value;
  const item = document.getElementById("item_filter").value;
  const task = document.getElementById("task_filter").value;

  allEntries = data;
  reportData = data.filter(entry => {
    if (from && entry.work_date < from) return false;
    if (to && entry.work_date > to) return false;
    if (emp && entry.employee !== emp) return false;
    if (item && entry.item !== item) return false;
    if (task && entry.task !== task) return false;
    return true;
  });

  closeEntryFocusWindow();
  renderTable();
  renderSummary();

  const itemTaskReport = document.getElementById("itemTaskRateReport");
  if (itemTaskReport && !itemTaskReport.hidden) {
    renderItemTaskRateReport();
  }
}

function appendCell(row, value, label = "") {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value;
  row.appendChild(cell);
}

function getEntryDataStatus(entry) {
  return entry.data_status || (entry.work_date < "2026-05-21" ? "test data" : "live");
}

function formatSecondsPerUnit(value) {
  const secondsPerUnit = Number(value) || 0;
  if (!secondsPerUnit) return "0 sec/unit";
  return `${secondsPerUnit.toLocaleString(undefined, {
    maximumFractionDigits: 2
  })} sec/unit`;
}

function formatUnitsPerHour(value) {
  const unitsPerHour = Number(value) || 0;
  if (!unitsPerHour) return "0 units/hr";
  return `${unitsPerHour.toLocaleString(undefined, {
    maximumFractionDigits: 1
  })} units/hr`;
}

function formatRatePair(row) {
  return `${formatSecondsPerUnit(row.secondsPerUnit)}, ${formatUnitsPerHour(row.unitsPerHour)}`;
}

function summarizeProductionRates(entries, groupKeys) {
  const groups = new Map();

  entries.forEach(entry => {
    const quantity = Number(entry.quantity) || 0;
    const seconds = Number(entry.duration_seconds) || 0;
    if (quantity <= 0 || seconds <= 0) return;

    const values = groupKeys.map(key => entry[key] || "Unknown");
    const mapKey = values.join("\n");

    if (!groups.has(mapKey)) {
      groups.set(mapKey, {
        values,
        entries: 0,
        quantity: 0,
        seconds: 0
      });
    }

    const group = groups.get(mapKey);
    group.entries += 1;
    group.quantity += quantity;
    group.seconds += seconds;
  });

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      secondsPerUnit: group.quantity ? group.seconds / group.quantity : 0,
      unitsPerHour: group.seconds ? (group.quantity / group.seconds) * 3600 : 0
    }))
    .sort((a, b) => {
      const labelCompare = a.values.join(" ").localeCompare(b.values.join(" "));
      return labelCompare || a.secondsPerUnit - b.secondsPerUnit;
    });
}

function appendAverageSummaryList(container, heading, rows, formatRow) {
  if (!rows.length) return;

  const section = document.createElement("div");
  section.className = "average-summary";

  const title = document.createElement("h4");
  title.textContent = heading;
  section.appendChild(title);

  const list = document.createElement("ol");
  list.className = "average-summary-list";
  rows.forEach(row => {
    const item = document.createElement("li");
    item.textContent = formatRow(row);
    list.appendChild(item);
  });
  section.appendChild(list);

  container.appendChild(section);
}

function getEntriesFilterDescription() {
  const from = document.getElementById("from_date").value;
  const to = document.getElementById("to_date").value;
  const employee = document.getElementById("employee_filter").value;
  const item = document.getElementById("item_filter").value;
  const task = document.getElementById("task_filter").value;
  const filters = [];

  if (from || to) {
    filters.push(`Dates: ${from || "Any"} to ${to || "Any"}`);
  }
  if (employee) filters.push(`Employee: ${employee}`);
  if (item) filters.push(`Item: ${item}`);
  if (task) filters.push(`Task: ${task}`);

  return filters.length ? filters.join(" | ") : "All entries";
}

function appendReportCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value;
  row.appendChild(cell);
}

function getEntryFilterValues() {
  return {
    from: document.getElementById("from_date").value,
    to: document.getElementById("to_date").value,
    employee: document.getElementById("employee_filter").value,
    item: document.getElementById("item_filter").value,
    task: document.getElementById("task_filter").value
  };
}

function shouldShowDetailedEntriesTable() {
  const filters = getEntryFilterValues();
  return Boolean(filters.from && filters.to && filters.item && filters.task);
}

function renderItemTaskRateReport() {
  const container = document.getElementById("itemTaskRateReport");
  const rows = summarizeProductionRates(reportData, ["item", "task"]);
  container.hidden = false;
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "printable-report-header";

  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = "Task Average Seconds Per Unit by Item";
  titleBlock.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "printable-report-meta";
  meta.textContent = `${getEntriesFilterDescription()} | Generated ${new Date().toLocaleString()}`;
  titleBlock.appendChild(meta);
  header.appendChild(titleBlock);

  const actions = document.createElement("div");
  actions.className = "printable-report-actions";

  const printButton = document.createElement("button");
  printButton.type = "button";
  printButton.textContent = "Print Report";
  printButton.addEventListener("click", printItemTaskRateReport);
  actions.appendChild(printButton);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Hide Report";
  closeButton.addEventListener("click", () => {
    container.hidden = true;
  });
  actions.appendChild(closeButton);

  header.appendChild(actions);
  container.appendChild(header);

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "printable-report-empty";
    empty.textContent = "No completed entries with quantity and time match the current filters.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "item-task-rate-table";
  const headerRow = document.createElement("tr");
  ["Task", "Entries", "Total Qty", "Total Time", "Avg Sec/Unit", "Avg Units/Hour"].forEach(label => {
    const cell = document.createElement("th");
    cell.textContent = label;
    headerRow.appendChild(cell);
  });
  table.appendChild(headerRow);

  const rowsByItem = new Map();
  rows.forEach(row => {
    const item = row.values[0];
    if (!rowsByItem.has(item)) rowsByItem.set(item, []);
    rowsByItem.get(item).push(row);
  });

  rowsByItem.forEach((itemRows, itemName) => {
    const itemRow = document.createElement("tr");
    itemRow.className = "item-group-row";
    const itemCell = document.createElement("td");
    itemCell.colSpan = 6;
    itemCell.textContent = itemName;
    itemRow.appendChild(itemCell);
    table.appendChild(itemRow);

    itemRows.forEach(row => {
      const taskRow = document.createElement("tr");
      appendReportCell(taskRow, row.values[1]);
      appendReportCell(taskRow, row.entries, "number-cell");
      appendReportCell(taskRow, row.quantity.toLocaleString(), "number-cell");
      appendReportCell(taskRow, secondsToHMS(row.seconds), "number-cell");
      appendReportCell(taskRow, formatSecondsPerUnit(row.secondsPerUnit), "number-cell");
      appendReportCell(taskRow, formatUnitsPerHour(row.unitsPerHour), "number-cell");
      table.appendChild(taskRow);
    });
  });

  container.appendChild(table);
}

async function generateItemTaskRateReport() {
  await loadReport();
  renderItemTaskRateReport();
  document.getElementById("itemTaskRateReport").scrollIntoView({ behavior: "smooth", block: "start" });
}

function printItemTaskRateReport() {
  const container = document.getElementById("itemTaskRateReport");
  if (container.hidden) {
    renderItemTaskRateReport();
  }

  document.body.classList.add("printing-item-task-report");
  window.print();
}

function createDetailedEntriesTable(entries) {
  const table = document.createElement("table");
  table.className = "mobile-stack";
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";

  const labels = ["Date", "Status", "Employee", "Item", "Dispensary", "Task", "Qty", "Time", "Sec/Unit", "Action"];
  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label === "Action" ? "" : label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  entries.forEach(entry => {
    const row = document.createElement("tr");
    const dataStatus = getEntryDataStatus(entry);
    if (dataStatus === "test data") {
      row.classList.add("test-data-row");
      row.style.backgroundColor = "#f1f1f1";
      row.style.color = "#777";
    }

    appendCell(row, entry.work_date, labels[0]);
    appendCell(row, dataStatus, labels[1]);
    appendCell(row, entry.employee, labels[2]);
    appendCell(row, entry.item, labels[3]);
    appendCell(row, entry.dispensary_name || "", labels[4]);
    appendCell(row, entry.task, labels[5]);
    appendCell(row, entry.quantity || 0, labels[6]);
    appendCell(row, secondsToHMS(entry.duration_seconds), labels[7]);
    appendCell(row, Math.round(entry.sec_per_unit || 0), labels[8]);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[9];
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editEntry(entry.log_id));
    actionCell.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteEntry(entry.log_id));
    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);

    table.appendChild(row);
  });

  return table;
}

function getEntryGroupLabel(item, task) {
  return `${item} - ${task}`;
}

function groupEntriesByItemAndTask(entries) {
  const groups = new Map();

  entries.forEach(entry => {
    const item = entry.item || "Unknown Item";
    const task = entry.task || "Unknown Task";
    const key = `${item}\n${task}`;
    if (!groups.has(key)) {
      groups.set(key, { item, task });
    }
  });

  return Array.from(groups.values()).sort((a, b) =>
    getEntryGroupLabel(a.item, a.task).localeCompare(getEntryGroupLabel(b.item, b.task))
  );
}

function createGroupedEntriesTable() {
  const groups = groupEntriesByItemAndTask(reportData);
  const table = document.createElement("table");
  table.className = "mobile-stack";
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";

  ["Label", "Item", "Task"].forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  groups.forEach(group => {
    const item = group.item;
    const task = group.task;
    const row = document.createElement("tr");
    row.className = "entry-group-row";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `Show entries for ${getEntryGroupLabel(item, task)}`);

    appendCell(row, getEntryGroupLabel(item, task), "Label");
    appendCell(row, item, "Item");
    appendCell(row, task, "Task");

    row.addEventListener("click", () => showEntryFocusWindow(item, task));
    row.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      showEntryFocusWindow(item, task);
    });

    table.appendChild(row);
  });

  return table;
}

function renderTable() {
  const container = document.getElementById("table");
  container.innerHTML = "";

  if (shouldShowDetailedEntriesTable()) {
    container.appendChild(createDetailedEntriesTable(reportData));
    return;
  }

  container.appendChild(createGroupedEntriesTable());
}

function showEntryFocusWindow(item, task) {
  const container = document.getElementById("entryFocusWindow");
  const entries = reportData.filter(entry => entry.item === item && entry.task === task);
  const totalQty = entries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
  const totalTime = entries.reduce((sum, entry) => sum + (Number(entry.duration_seconds) || 0), 0);
  const avgSeconds = totalQty ? totalTime / totalQty : 0;
  const unitsPerHour = totalTime ? (totalQty / totalTime) * 3600 : 0;

  container.hidden = false;
  container.innerHTML = "";

  const header = document.createElement("div");
  header.className = "entry-focus-header";

  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = getEntryGroupLabel(item, task);
  titleBlock.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "entry-focus-meta";
  meta.textContent = `${entries.length} entries | Total Qty: ${totalQty.toLocaleString()} | Total Time: ${secondsToHMS(totalTime)} | ${formatSecondsPerUnit(avgSeconds)} | ${formatUnitsPerHour(unitsPerHour)}`;
  titleBlock.appendChild(meta);
  header.appendChild(titleBlock);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", closeEntryFocusWindow);
  header.appendChild(closeButton);

  container.appendChild(header);
  container.appendChild(createDetailedEntriesTable(entries));
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEntryFocusWindow() {
  const container = document.getElementById("entryFocusWindow");
  if (!container) return;
  container.hidden = true;
  container.innerHTML = "";
}

function renderSummary() {
  let totalQty = 0;
  let totalTime = 0;

  reportData.forEach(entry => {
    totalQty += entry.quantity || 0;
    totalTime += entry.duration_seconds || 0;
  });

  const avg = totalQty ? Math.round(totalTime / totalQty) : 0;
  const unitsPerHour = totalTime ? (totalQty / totalTime) * 3600 : 0;
  const emp = document.getElementById("employee_filter").value;
  const item = document.getElementById("item_filter").value;
  const task = document.getElementById("task_filter").value;
  const summary = document.getElementById("summary");

  summary.innerHTML = `
    <div class="summary-line">
      <span><b>Total Qty:</b> ${totalQty}</span>
      <span><b>Total Time:</b> ${secondsToHMS(totalTime)}</span>
      <span><b>Avg Sec/Unit:</b> ${avg}</span>
      <span><b>Avg Units/Hour:</b> ${formatUnitsPerHour(unitsPerHour)}</span>
    </div>
  `;

  if (emp) {
    appendAverageSummaryList(
      summary,
      `${emp} average rates by item and task`,
      summarizeProductionRates(reportData, ["item", "task"]),
      row => `${row.values[0]} - ${row.values[1]}: ${formatRatePair(row)}`
    );
    return;
  }

  if (item && !task) {
    appendAverageSummaryList(
      summary,
      `Average rates by task and employee for ${item}`,
      summarizeProductionRates(reportData, ["task", "employee"]),
      row => `${row.values[0]} - ${row.values[1]}: ${formatRatePair(row)}`
    );
    return;
  }

  if (item || task) {
    appendAverageSummaryList(
      summary,
      `Average rates by employee for ${[item, task].filter(Boolean).join(" - ")}`,
      summarizeProductionRates(reportData, ["employee"]),
      row => `${row.values[0]}: ${formatRatePair(row)}`
    );
  }
}

function editEntry(logId) {
  const entry = allEntries.find(item => item.log_id === logId);
  if (!entry) return;

  document.getElementById("edit_log_id").value = entry.log_id;
  document.getElementById("edit_work_date").value = entry.work_date;
  document.getElementById("edit_employee").value = entry.employee;
  document.getElementById("edit_item").value = String(entry.item_id);
  document.getElementById("edit_task").value = String(entry.task_id);
  document.getElementById("edit_dispensary_name").value = entry.dispensary_name || "";
  updateAdminDispensaryField();
  document.getElementById("edit_quantity").value = entry.quantity || 0;
  document.getElementById("edit_time").value = secondsToHMS(entry.duration_seconds);
  document.getElementById("editPanel").classList.add("active");
  showMessage("");
  document.getElementById("edit_quantity").focus();
}

function cancelEntryEdit() {
  document.getElementById("editPanel").classList.remove("active");
  document.getElementById("edit_log_id").value = "";
  showMessage("");
}

async function saveEntryEdit() {
  const logId = document.getElementById("edit_log_id").value;
  const durationSeconds = parseHMSToSeconds(document.getElementById("edit_time").value);

  if (!logId) return;

  if (durationSeconds === null) {
    showMessage("Enter time as HH:MM:SS, MM:SS, or total seconds.", "error");
    return;
  }

  const payload = {
    work_date: document.getElementById("edit_work_date").value,
    employee: document.getElementById("edit_employee").value,
    item_id: document.getElementById("edit_item").value,
    task_id: document.getElementById("edit_task").value,
    dispensary_name: document.getElementById("edit_dispensary_name").value,
    quantity: document.getElementById("edit_quantity").value,
    duration_seconds: durationSeconds
  };

  const res = await adminFetch(`/admin/entries/${logId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Save failed: " + text, "error");
    return;
  }

  cancelEntryEdit();
  showMessage("Entry updated.", "success");
  await loadReport();
}

async function deleteEntry(logId) {
  const entry = allEntries.find(item => item.log_id === logId);
  if (!entry) return;

  const label = `${entry.work_date} - ${entry.employee} - ${entry.item} - ${entry.task}`;
  const shouldDelete = confirm(`Delete this entry?\n\n${label}\n\nThis cannot be undone.`);
  if (!shouldDelete) return;

  const res = await adminFetch(`/admin/entries/${logId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Delete failed: " + text, "error");
    return;
  }

  if (document.getElementById("edit_log_id").value === String(logId)) {
    cancelEntryEdit();
  }

  showMessage("Entry deleted.", "success");
  await loadReport();
}

function renderFlaggedEntryReview() {
  const container = document.getElementById("flaggedEntryReviewTable");
  container.innerHTML = "";

  if (!flaggedReviewEntries.length) {
    const empty = document.createElement("p");
    empty.className = "printable-report-empty";
    empty.textContent = "No entries need review.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";
  const labels = ["Date", "Employee", "Item", "Dispensary", "Task", "Qty", "Time", "Sec/Unit", "Alert Level", "Reason", "Action"];

  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label === "Action" ? "" : label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  flaggedReviewEntries.forEach(entry => {
    const row = document.createElement("tr");
    row.className = "flagged-entry-row";

    [
      entry.work_date,
      entry.employee,
      entry.item,
      entry.dispensary_name || "",
      entry.task,
      entry.quantity || 0,
      secondsToHMS(entry.duration_seconds),
      formatSecondsPerUnit(entry.sec_per_unit),
      entry.seconds_per_unit_alert_level ? formatSecondsPerUnit(entry.seconds_per_unit_alert_level) : "",
      entry.flag_reason || ""
    ].forEach((value, index) => {
      const cell = document.createElement("td");
      cell.dataset.label = labels[index];
      cell.textContent = value;
      if (labels[index] === "Reason") {
        cell.className = "flagged-entry-reason";
      }
      row.appendChild(cell);
    });

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[10];
    actionCell.className = "flagged-entry-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editReviewEntry(entry.log_id));
    actionCell.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteReviewEntry(entry.log_id));
    actionCell.appendChild(deleteButton);

    const dismissButton = document.createElement("button");
    dismissButton.type = "button";
    dismissButton.textContent = "Dismiss";
    dismissButton.addEventListener("click", () => dismissReviewEntry(entry.log_id));
    actionCell.appendChild(dismissButton);

    row.appendChild(actionCell);
    table.appendChild(row);
  });

  container.appendChild(table);
}

function renderConcernEntries() {
  const container = document.getElementById("entryConcernsTable");
  container.innerHTML = "";
  const activeConcernEntries = getActiveConcernEntries();

  if (!activeConcernEntries.length) {
    const empty = document.createElement("p");
    empty.className = "printable-report-empty";
    empty.textContent = "No entries of concern.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";
  const labels = ["Date", "Employee", "Item", "Dispensary", "Task", "Qty", "Time", "Reason", "Notes", "Action"];

  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label === "Action" ? "" : label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  activeConcernEntries.forEach(entry => {
    const row = document.createElement("tr");
    row.className = "flagged-entry-row";

    [
      entry.work_date,
      entry.employee,
      entry.item,
      entry.dispensary_name || "",
      entry.task,
      entry.quantity || 0,
      secondsToHMS(entry.duration_seconds),
      entry.flag_reason || "Dismissed for follow-up"
    ].forEach((value, index) => {
      const cell = document.createElement("td");
      cell.dataset.label = labels[index];
      cell.textContent = value;
      if (labels[index] === "Reason") {
        cell.className = "flagged-entry-reason";
      }
      row.appendChild(cell);
    });

    const notesCell = document.createElement("td");
    notesCell.dataset.label = "Notes";

    const notesWrapper = document.createElement("div");
    notesWrapper.className = "concern-notes";

    const notesInput = document.createElement("textarea");
    notesInput.value = entry.concern_notes || "";
    notesInput.placeholder = "Enter details of actions taken";
    notesInput.setAttribute("aria-label", "Details of actions taken");
    notesWrapper.appendChild(notesInput);

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save Notes";
    saveButton.addEventListener("click", () => saveConcernNotes(entry.log_id, notesInput.value));
    notesWrapper.appendChild(saveButton);

    notesCell.appendChild(notesWrapper);
    row.appendChild(notesCell);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[9];
    actionCell.className = "flagged-entry-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editReviewEntry(entry.log_id));
    actionCell.appendChild(editButton);

    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.textContent = "Undo Dismissal";
    undoButton.addEventListener("click", () => undoConcernDismissal(entry.log_id));
    actionCell.appendChild(undoButton);

    row.appendChild(actionCell);
    table.appendChild(row);
  });

  container.appendChild(table);
}

function getActiveConcernEntries() {
  return concernEntries.filter(entry => !String(entry.concern_notes || "").trim());
}

function getLoggedConcernEntries() {
  return concernEntries.filter(entry => String(entry.concern_notes || "").trim());
}

function renderLoggedConcernEmployees() {
  const container = document.getElementById("loggedConcernEmployees");
  const focus = document.getElementById("loggedConcernFocus");
  container.innerHTML = "";
  if (focus) {
    focus.hidden = true;
    focus.innerHTML = "";
  }

  const loggedEntries = getLoggedConcernEntries();
  if (!loggedEntries.length) {
    const empty = document.createElement("p");
    empty.className = "printable-report-empty";
    empty.textContent = "No logged entries of concern.";
    container.appendChild(empty);
    return;
  }

  const employees = [...new Set(loggedEntries.map(entry => entry.employee || "Unknown Employee"))]
    .sort((a, b) => a.localeCompare(b));

  employees.forEach(employee => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${employee} (${loggedEntries.filter(entry => (entry.employee || "Unknown Employee") === employee).length})`;
    button.addEventListener("click", () => showLoggedConcernFocus(employee));
    container.appendChild(button);
  });
}

async function loadFlaggedEntryReview() {
  const [reviewRes, concernsRes] = await Promise.all([
    adminFetch("/admin/flagged-entries"),
    adminFetch("/admin/concern-entries")
  ]);

  if (!reviewRes.ok) {
    const text = await reviewRes.text();
    showMessage("Entries for review load failed: " + text, "error");
    return;
  }

  if (!concernsRes.ok) {
    const text = await concernsRes.text();
    showMessage("Entries of concern load failed: " + text, "error");
    return;
  }

  flaggedReviewEntries = await reviewRes.json();
  concernEntries = await concernsRes.json();
  renderFlaggedEntryReview();
  renderConcernEntries();
  renderLoggedConcernEmployees();
}

function editReviewEntry(logId) {
  const entry = findReviewEntry(logId);
  if (!entry) return;

  document.getElementById("review_edit_log_id").value = entry.log_id;
  document.getElementById("review_edit_work_date").value = entry.work_date;
  document.getElementById("review_edit_employee").value = entry.employee;
  document.getElementById("review_edit_item").value = String(entry.item_id);
  fillReviewTaskOptions(entry.item_id, entry.task_id);
  document.getElementById("review_edit_task").value = String(entry.task_id);
  document.getElementById("review_edit_dispensary_name").value = entry.dispensary_name || "";
  document.getElementById("review_edit_quantity").value = entry.quantity || 0;
  document.getElementById("review_edit_time").value = secondsToHMS(entry.duration_seconds);
  document.getElementById("reviewEditPanel").classList.add("active");
  showMessage("");
  document.getElementById("review_edit_quantity").focus();
}

function findReviewEntry(logId) {
  return flaggedReviewEntries.find(item => item.log_id === logId) ||
    concernEntries.find(item => item.log_id === logId);
}

function cancelReviewEntryEdit() {
  document.getElementById("reviewEditPanel").classList.remove("active");
  document.getElementById("review_edit_log_id").value = "";
  showMessage("");
}

async function saveReviewEntryEdit() {
  const logId = document.getElementById("review_edit_log_id").value;
  const durationSeconds = parseHMSToSeconds(document.getElementById("review_edit_time").value);

  if (!logId) return;

  if (durationSeconds === null) {
    showMessage("Enter time as HH:MM:SS, MM:SS, or total seconds.", "error");
    return;
  }

  const payload = {
    work_date: document.getElementById("review_edit_work_date").value,
    employee: document.getElementById("review_edit_employee").value,
    item_id: document.getElementById("review_edit_item").value,
    task_id: document.getElementById("review_edit_task").value,
    dispensary_name: document.getElementById("review_edit_dispensary_name").value,
    quantity: document.getElementById("review_edit_quantity").value,
    duration_seconds: durationSeconds
  };

  const res = await adminFetch(`/admin/entries/${logId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Save failed: " + text, "error");
    return;
  }

  cancelReviewEntryEdit();
  showMessage("Entry updated.", "success");
  await loadFlaggedEntryReview();
}

async function deleteReviewEntry(logId) {
  const entry = flaggedReviewEntries.find(item => item.log_id === logId);
  if (!entry) return;

  const label = `${entry.work_date} - ${entry.employee} - ${entry.item} - ${entry.task}`;
  const shouldDelete = confirm(`Delete this entry?\n\n${label}\n\nThis cannot be undone.`);
  if (!shouldDelete) return;

  const res = await adminFetch(`/admin/entries/${logId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Delete failed: " + text, "error");
    return;
  }

  if (document.getElementById("review_edit_log_id").value === String(logId)) {
    cancelReviewEntryEdit();
  }

  showMessage("Entry deleted.", "success");
  await loadFlaggedEntryReview();
}

async function dismissReviewEntry(logId) {
  const entry = flaggedReviewEntries.find(item => item.log_id === logId);
  if (!entry) return;

  const res = await adminFetch(`/admin/entries/${logId}/concern`, {
    method: "POST"
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Dismiss failed: " + text, "error");
    return;
  }

  if (document.getElementById("review_edit_log_id").value === String(logId)) {
    cancelReviewEntryEdit();
  }

  showMessage("Entry moved to entries of concern.", "success");
  await loadFlaggedEntryReview();
}

async function saveConcernNotes(logId, notes) {
  const res = await adminFetch(`/admin/entries/${logId}/concern-notes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes })
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Concern notes save failed: " + text, "error");
    return;
  }

  showMessage("Concern notes saved.", "success");
  const entry = concernEntries.find(item => item.log_id === logId);
  if (entry) entry.concern_notes = notes;
  renderConcernEntries();
  renderLoggedConcernEmployees();
}

async function undoConcernDismissal(logId) {
  const entry = concernEntries.find(item => item.log_id === logId);
  if (!entry) return;

  const res = await adminFetch(`/admin/entries/${logId}/concern`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Undo dismissal failed: " + text, "error");
    return;
  }

  if (document.getElementById("review_edit_log_id").value === String(logId)) {
    cancelReviewEntryEdit();
  }

  showMessage("Dismissal undone.", "success");
  await loadFlaggedEntryReview();
}

function getConcernEntryRateText(entry) {
  const quantity = Number(entry.quantity) || 0;
  const seconds = Number(entry.duration_seconds) || 0;
  if (quantity <= 0 || seconds <= 0) return "No rate";
  return formatSecondsPerUnit(seconds / quantity);
}

function getConcernEntryAverageText(entry) {
  const average = Number(entry.task_average_seconds_per_unit) || 0;
  return average > 0 ? formatSecondsPerUnit(average) : "No average";
}

function getConcernEntryRateDeltaText(entry) {
  const quantity = Number(entry.quantity) || 0;
  const seconds = Number(entry.duration_seconds) || 0;
  const average = Number(entry.task_average_seconds_per_unit) || 0;
  if (quantity <= 0 || seconds <= 0 || average <= 0) return "";

  const entryRate = seconds / quantity;
  const difference = entryRate - average;
  if (!difference) return "Matches average";
  return `${formatSecondsPerUnit(Math.abs(difference))} ${difference > 0 ? "slower" : "faster"} than average`;
}

function showLoggedConcernFocus(employee) {
  const focus = document.getElementById("loggedConcernFocus");
  const entries = getLoggedConcernEntries()
    .filter(entry => (entry.employee || "Unknown Employee") === employee)
    .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.log_id - a.log_id);

  focus.hidden = false;
  focus.innerHTML = "";

  const header = document.createElement("div");
  header.className = "printable-report-header";

  const titleBlock = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = `Logged Entries of Concern - ${employee}`;
  titleBlock.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "printable-report-meta";
  meta.textContent = `${entries.length} entr${entries.length === 1 ? "y" : "ies"} | Generated ${new Date().toLocaleString()}`;
  titleBlock.appendChild(meta);
  header.appendChild(titleBlock);

  const actions = document.createElement("div");
  actions.className = "printable-report-actions";

  const printButton = document.createElement("button");
  printButton.type = "button";
  printButton.textContent = "Print Report";
  printButton.addEventListener("click", printLoggedConcernReport);
  actions.appendChild(printButton);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => {
    focus.hidden = true;
    focus.innerHTML = "";
  });
  actions.appendChild(closeButton);

  header.appendChild(actions);
  focus.appendChild(header);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "printable-report-empty";
    empty.textContent = "No logged entries of concern for this employee.";
    focus.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const headerRow = document.createElement("tr");
  ["Date", "Item", "Dispensary", "Task", "Qty", "Employee Time", "Employee Rate", "Task Avg Rate", "Comparison", "Notes"].forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  entries.forEach(entry => {
    const row = document.createElement("tr");
    appendCell(row, entry.work_date, "Date");
    appendCell(row, entry.item, "Item");
    appendCell(row, entry.dispensary_name || "", "Dispensary");
    appendCell(row, entry.task, "Task");
    appendCell(row, entry.quantity || 0, "Qty");
    appendCell(row, secondsToHMS(entry.duration_seconds), "Employee Time");
    appendCell(row, getConcernEntryRateText(entry), "Employee Rate");
    appendCell(row, getConcernEntryAverageText(entry), "Task Avg Rate");
    appendCell(row, getConcernEntryRateDeltaText(entry), "Comparison");
    appendCell(row, entry.concern_notes || "", "Notes");
    table.appendChild(row);
  });

  focus.appendChild(table);
  focus.scrollIntoView({ behavior: "smooth", block: "start" });
}

function printLoggedConcernReport() {
  const focus = document.getElementById("loggedConcernFocus");
  if (focus.hidden) return;

  document.body.classList.add("printing-concern-report");
  window.print();
}

async function loadItemTaskManagement() {
  const res = await adminFetch("/admin/item-task-management");
  if (!res.ok) {
    const text = await res.text();
    showMessage("Item and task management load failed: " + text, "error");
    return;
  }

  const data = await res.json();
  allItems = data.items || [];
  allTasks = data.tasks || [];
  itemTaskManagementAssignments = data.assignments || [];
  itemTaskOptionsByItemId = buildItemTaskOptionsByItemId(itemTaskManagementAssignments);

  renderItemTaskManagement();
  renderMasterTaskList();
}

function renderItemTaskManagement() {
  const container = document.getElementById("itemTaskManagementList");
  if (!container) return;
  container.innerHTML = "";

  allItems.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-task-card";

    const header = document.createElement("div");
    header.className = "item-task-card-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "item-task-card-title";

    const title = document.createElement("b");
    title.textContent = item.name;
    titleWrap.appendChild(title);

    if (item.production_company) {
      const company = document.createElement("span");
      company.className = "item-task-company";
      company.textContent = item.production_company;
      titleWrap.appendChild(company);
    }

    header.appendChild(titleWrap);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editItemTaskAssignments(item.id));
    header.appendChild(editButton);
    card.appendChild(header);

    const assignedTaskIds = itemTaskOptionsByItemId[String(item.id)] || [];
    if (!assignedTaskIds.length) {
      const empty = document.createElement("div");
      empty.className = "empty-entries";
      empty.textContent = "No tasks assigned.";
      card.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      list.className = "item-task-list";
      assignedTaskIds
        .map(getTaskName)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .forEach(taskName => {
          const itemNode = document.createElement("li");
          itemNode.textContent = taskName;
          list.appendChild(itemNode);
        });
      card.appendChild(list);
    }

    container.appendChild(card);
  });
}

function renderMasterTaskList() {
  const container = document.getElementById("masterTaskList");
  if (!container) return;
  container.innerHTML = "";

  allTasks.forEach(task => {
    const row = document.createElement("div");
    row.className = "master-task-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = task.name;
    input.dataset.taskId = String(task.id);
    row.appendChild(input);

    const alertInput = document.createElement("input");
    alertInput.type = "number";
    alertInput.min = "0";
    alertInput.step = "0.01";
    alertInput.value = String(Number(task.seconds_per_unit_alert_level) || 0);
    alertInput.setAttribute("aria-label", `${task.name} alert seconds per unit`);
    row.appendChild(alertInput);

    const averageLabel = document.createElement("span");
    averageLabel.className = "master-task-average";
    averageLabel.textContent = Number(task.average_seconds_per_unit) > 0
      ? `Avg ${formatSecondsPerUnit(task.average_seconds_per_unit)}`
      : "";
    row.appendChild(averageLabel);

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save";
    saveButton.addEventListener("click", () => updateMasterTask(task.id, input.value, alertInput.value));
    row.appendChild(saveButton);

    container.appendChild(row);
  });
}

function editItemTaskAssignments(itemId) {
  const item = allItems.find(option => String(option.id) === String(itemId));
  if (!item) return;

  document.getElementById("item_task_edit_item_id").value = String(item.id);
  document.getElementById("itemTaskEditTitle").textContent = `Edit Tasks for ${item.name}`;

  const assignedTaskIds = new Set((itemTaskOptionsByItemId[String(item.id)] || []).map(String));
  const container = document.getElementById("itemTaskEditOptions");
  container.innerHTML = "";

  allTasks.forEach(task => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = String(task.id);
    checkbox.checked = assignedTaskIds.has(String(task.id));
    checkbox.addEventListener("change", updateItemTaskEditCount);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(task.name));
    container.appendChild(label);
  });

  document.getElementById("itemTaskEditPanel").hidden = false;
  updateItemTaskEditCount();
  showMessage("");
  const firstCheckbox = container.querySelector("input");
  if (firstCheckbox) firstCheckbox.focus();
}

function updateItemTaskEditCount() {
  const checkedCount = document.querySelectorAll("#itemTaskEditOptions input:checked").length;
  const totalCount = document.querySelectorAll("#itemTaskEditOptions input").length;
  const count = document.getElementById("itemTaskEditCount");
  if (!count) return;
  count.textContent = `${checkedCount} of ${totalCount} task${totalCount === 1 ? "" : "s"} assigned to this item.`;
}

function cancelItemTaskEdit() {
  document.getElementById("itemTaskEditPanel").hidden = true;
  document.getElementById("item_task_edit_item_id").value = "";
  document.getElementById("itemTaskEditOptions").innerHTML = "";
  showMessage("");
}

async function saveItemTaskAssignments() {
  const itemId = document.getElementById("item_task_edit_item_id").value;
  if (!itemId) return;

  const taskIds = Array.from(document.querySelectorAll("#itemTaskEditOptions input:checked"))
    .map(input => Number(input.value));

  const res = await adminFetch(`/admin/items/${itemId}/tasks`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_ids: taskIds })
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Save failed: " + text, "error");
    return;
  }

  cancelItemTaskEdit();
  showMessage("Item tasks updated.", "success");
  await loadItemTaskManagement();
}

async function addMasterTask() {
  const input = document.getElementById("new_master_task_name");
  const alertInput = document.getElementById("new_master_task_alert_level");
  const name = input.value.trim();
  const alertLevel = Number(alertInput.value) || 0;
  if (!name) {
    showMessage("Task name is required.", "error");
    input.focus();
    return;
  }
  if (alertLevel < 0) {
    showMessage("Alert level must be zero or greater.", "error");
    alertInput.focus();
    return;
  }

  const res = await adminFetch("/admin/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, seconds_per_unit_alert_level: alertLevel })
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Task add failed: " + text, "error");
    return;
  }

  input.value = "";
  alertInput.value = "";
  showMessage("Task added.", "success");
  await loadItemTaskManagement();
}

async function addNewItem() {
  const input = document.getElementById("new_item_name");
  const companySelect = document.getElementById("new_item_company");
  const name = input.value.trim();
  const productionCompany = companySelect.value;

  if (!name) {
    showMessage("Item name is required.", "error");
    input.focus();
    return;
  }

  const res = await adminFetch("/admin/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, production_company: productionCompany })
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Item add failed: " + text, "error");
    return;
  }

  input.value = "";
  companySelect.value = "Hijnx";
  showMessage("Item added.", "success");
  await loadLookups();
  await loadItemTaskManagement();
}

async function updateMasterTask(taskId, nameValue, alertLevelValue) {
  const name = String(nameValue || "").trim();
  const alertLevel = Number(alertLevelValue) || 0;
  if (!name) {
    showMessage("Task name is required.", "error");
    return;
  }
  if (alertLevel < 0) {
    showMessage("Alert level must be zero or greater.", "error");
    return;
  }

  const res = await adminFetch(`/admin/tasks/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, seconds_per_unit_alert_level: alertLevel })
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Task update failed: " + text, "error");
    return;
  }

  showMessage("Task updated.", "success");
  await loadItemTaskManagement();
}

function exportCSV() {
  if (!reportData.length) return;

  let csv = "Date,Status,Employee,Item,Dispensary,Task,Qty,Total Time,Sec/Unit\n";

  reportData.forEach(entry => {
    csv += [
      entry.work_date,
      getEntryDataStatus(entry),
      entry.employee,
      entry.item,
      entry.dispensary_name || "",
      entry.task,
      entry.quantity,
      entry.duration_seconds,
      Math.round(entry.sec_per_unit || 0)
    ].map(csvValue).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function setDefaultCalendarRange() {
  adminCalendarStartDate = startOfWeek(new Date());
}

function updateCalendarRangeLabel(gridStart, gridEnd) {
  document.getElementById("calendar_range_label").textContent =
    `${formatDisplayDate(toIsoDate(gridStart))} - ${formatDisplayDate(toIsoDate(gridEnd))}`;
}

function changeAdminCalendarWeeks(offset) {
  if (!adminCalendarStartDate) {
    setDefaultCalendarRange();
  }

  adminCalendarStartDate = addDays(adminCalendarStartDate, offset * 14);
  loadAdminCalendar();
}

async function loadAdminCalendar() {
  if (!adminCalendarStartDate) {
    setDefaultCalendarRange();
  }

  const gridStart = dateOnly(adminCalendarStartDate);
  const gridEnd = addDays(gridStart, 41);
  const from = toIsoDate(addDays(gridStart, -3650));
  const to = toIsoDate(gridEnd);
  const [scheduleRes, orderedRes] = await Promise.all([
    fetch(`/schedule?from=${from}&to=${to}`),
    fetch("/ordered-items")
  ]);

  if (!scheduleRes.ok) {
    showMessage("Could not load calendar.", "error");
    return;
  }

  const rows = await scheduleRes.json();
  const deliveries = orderedRes.ok ? await orderedRes.json() : [];
  adminScheduleRows = new Map(rows.map(row => [row.schedule_date, row.tasks || ""]));
  adminExpectedDeliveriesByDate = buildAdminExpectedDeliveriesByDate(deliveries, gridStart, gridEnd);
  adminActiveScheduleByDate = buildAdminActiveScheduleByDate(rows, gridStart, gridEnd);
  updateCalendarRangeLabel(gridStart, gridEnd);
  renderAdminCalendar(gridStart);
}

function countGroupedTasks(tasks) {
  return groupDailyTaskAssignments(tasks).length;
}

function createDailyReportCard({ title, count, note, className, onFocus }) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = `daily-report-card ${className}`;
  card.addEventListener("click", onFocus);

  const heading = document.createElement("h4");
  heading.textContent = title;
  card.appendChild(heading);

  const countElement = document.createElement("div");
  countElement.className = "daily-report-card-count";
  countElement.textContent = String(count);
  card.appendChild(countElement);

  const noteElement = document.createElement("div");
  noteElement.className = "daily-report-card-note";
  noteElement.textContent = note;
  card.appendChild(noteElement);

  return card;
}

function showDailyReportFocus(titleText, fill) {
  const panel = document.getElementById("dailyReportFocus");
  const title = document.getElementById("dailyReportFocusTitle");
  const body = document.getElementById("dailyReportFocusBody");
  if (!panel || !title || !body) return;

  title.textContent = titleText;
  body.innerHTML = "";
  fill(body);
  panel.hidden = false;
  const closeButton = panel.querySelector("button");
  if (closeButton) closeButton.focus();
}

function closeDailyReportFocus() {
  const panel = document.getElementById("dailyReportFocus");
  const body = document.getElementById("dailyReportFocusBody");
  if (!panel) return;

  panel.hidden = true;
  if (body) body.innerHTML = "";
}

function renderDailyWorkingBatches(batches) {
  const container = document.getElementById("dailyWorkingBatches");
  container.innerHTML = "";

  const workingBatches = batches.filter(batch => {
    const progress = getBatchProgress(batch);
    return progress.completed < progress.total;
  });

  if (!workingBatches.length) {
    const empty = document.createElement("div");
    empty.className = "calendar-focus-empty";
    empty.textContent = "No working batches.";
    container.appendChild(empty);
    return;
  }

  workingBatches.forEach(batch => {
    const progress = getBatchProgress(batch);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "daily-working-batch";
    card.addEventListener("click", () => showDailyReportFocus("Working Batch", body => appendBatchDetail(body, batch)));

    const pie = document.createElement("div");
    pie.className = "daily-batch-pie";
    pie.style.setProperty("--progress", `${progress.percent}%`);
    card.appendChild(pie);

    const text = document.createElement("div");
    const title = document.createElement("div");
    title.className = "daily-working-batch-title";
    title.textContent = `${batch.label}: ${batch.item}`;
    text.appendChild(title);

    if (batch.scheduleDate) {
      const scheduled = document.createElement("div");
      scheduled.className = "daily-working-batch-note";
      scheduled.textContent = formatDisplayDate(batch.scheduleDate);
      text.appendChild(scheduled);
    }

    const note = document.createElement("div");
    note.className = "daily-working-batch-note";
    note.textContent = getBatchStatusText(batch);
    text.appendChild(note);

    card.appendChild(text);
    container.appendChild(card);
  });
}

function getWorkingBatchesFromRows(rows) {
  return getBatchesFromScheduleRows(rows);
}

function getBatchesFromScheduleRows(rows) {
  return rows.flatMap(row => {
    const payload = parseSchedulePayload(row.tasks);
    return [
      ...payload.batchHijnx.map((batch, index) => ({
        label: "Hijnx",
        batchType: "hijnx",
        batchIndex: index,
        scheduleDate: row.schedule_date,
        ...batch
      })),
      ...payload.batchSb.map((batch, index) => ({
        label: "SB",
        batchType: "sb",
        batchIndex: index,
        scheduleDate: row.schedule_date,
        ...batch
      }))
    ];
  });
}

function createBatchTrackerCard(batch, completed) {
  const progress = getBatchProgress(batch);
  const card = document.createElement("article");
  card.className = `batch-tracker-card${completed ? " completed" : ""}`;

  const title = document.createElement("div");
  title.className = "batch-tracker-title";
  title.textContent = `${batch.label}: ${batch.item}`;
  card.appendChild(title);

  const scheduled = document.createElement("div");
  scheduled.className = "batch-tracker-meta";
  scheduled.textContent = `Scheduled day: ${formatDisplayDate(batch.scheduleDate)}`;
  card.appendChild(scheduled);

  if (batch.units) {
    const units = document.createElement("div");
    units.className = "batch-tracker-meta";
    units.textContent = `Units: ${batch.units}`;
    card.appendChild(units);
  }

  const progressRow = document.createElement("div");
  progressRow.className = "batch-tracker-progress";

  const pie = document.createElement("div");
  pie.className = "daily-batch-pie";
  pie.style.setProperty("--progress", `${progress.percent}%`);
  progressRow.appendChild(pie);

  const status = document.createElement("div");
  status.className = "batch-tracker-status";
  status.textContent = `${progress.percent}% - ${getBatchStatusText(batch)}`;
  progressRow.appendChild(status);
  card.appendChild(progressRow);

  const controls = document.createElement("div");
  controls.className = "batch-tracker-controls";
  const checkAllButton = document.createElement("button");
  checkAllButton.type = "button";
  checkAllButton.textContent = "Check All";
  checkAllButton.disabled = progress.completed === progress.total;
  checkAllButton.addEventListener("click", () => {
    const checklist = Object.fromEntries(batchChecklistItems.map(check => [check.key, true]));
    updateBatchTrackerChecklist(batch, checklist);
  });
  controls.appendChild(checkAllButton);
  card.appendChild(controls);

  const checklist = document.createElement("ul");
  checklist.className = "batch-tracker-checklist";
  batchChecklistItems.forEach(check => {
    const line = document.createElement("li");
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(batch.checklist && batch.checklist[check.key]);
    input.addEventListener("change", () => {
      updateBatchTrackerChecklist(batch, {
        ...(batch.checklist || {}),
        [check.key]: input.checked
      });
    });

    label.appendChild(input);
    label.append(document.createTextNode(check.label));
    line.appendChild(label);
    checklist.appendChild(line);
  });
  card.appendChild(checklist);

  return card;
}

async function updateBatchTrackerChecklist(batch, nextChecklist) {
  const scheduleRes = await fetch(`/schedule?from=${batch.scheduleDate}&to=${batch.scheduleDate}`);

  if (!scheduleRes.ok) {
    showMessage("Could not load the calendar day for this batch.", "error");
    await loadBatchTracker();
    return;
  }

  const rows = await scheduleRes.json();
  const row = rows.find(item => item.schedule_date === batch.scheduleDate);
  const payload = parseSchedulePayload(row && row.tasks);
  const batchList = batch.batchType === "hijnx" ? payload.batchHijnx : payload.batchSb;
  const currentBatch = batchList[batch.batchIndex];

  if (!currentBatch) {
    showMessage("That batch is no longer on the calendar.", "error");
    await loadBatchTracker();
    return;
  }

  currentBatch.checklist = Object.fromEntries(
    batchChecklistItems.map(check => [check.key, Boolean(nextChecklist[check.key])])
  );

  const saveRes = await adminFetch(`/admin/schedule/${batch.scheduleDate}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks: JSON.stringify(payload) })
  });

  if (!saveRes.ok) {
    const text = await saveRes.text();
    showMessage("Batch update failed: " + text, "error");
    await loadBatchTracker();
    return;
  }

  showMessage("Batch progress updated.", "success");
  await loadBatchTracker();
}

function formatBatchTrackerDayHeading(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${dayNames[date.getDay()]} ${formatDisplayDate(isoDate)}`;
}

function renderBatchTrackerSection(containerId, batches, emptyText, completed = false) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  if (!batches.length) {
    const empty = document.createElement("div");
    empty.className = "calendar-focus-empty";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  const batchesByDate = new Map();
  batches.forEach(batch => {
    if (!batchesByDate.has(batch.scheduleDate)) {
      batchesByDate.set(batch.scheduleDate, []);
    }
    batchesByDate.get(batch.scheduleDate).push(batch);
  });

  batchesByDate.forEach((dayBatches, scheduleDate) => {
    const dayGroup = document.createElement("section");
    dayGroup.className = "batch-tracker-day";

    const heading = document.createElement("div");
    heading.className = "batch-tracker-day-heading";
    heading.textContent = formatBatchTrackerDayHeading(scheduleDate);
    dayGroup.appendChild(heading);

    const cards = document.createElement("div");
    cards.className = "batch-tracker-day-cards";
    dayBatches.forEach(batch => cards.appendChild(createBatchTrackerCard(batch, completed)));
    dayGroup.appendChild(cards);

    container.appendChild(dayGroup);
  });
}

async function loadBatchTracker() {
  const todayDate = dateOnly(new Date());
  const from = toIsoDate(addDays(todayDate, -3650));
  const to = toIsoDate(addDays(todayDate, 1095));
  const scheduleRes = await fetch(`/schedule?from=${from}&to=${to}`);

  if (!scheduleRes.ok) {
    showMessage("Could not load batch tracker.", "error");
    return;
  }

  const rows = await scheduleRes.json();
  const batches = getBatchesFromScheduleRows(rows);
  const workingBatches = batches
    .filter(batch => {
      const progress = getBatchProgress(batch);
      return progress.completed < progress.total;
    })
    .sort((a, b) => a.scheduleDate.localeCompare(b.scheduleDate));
  const completedBatches = batches
    .filter(batch => {
      const progress = getBatchProgress(batch);
      return progress.completed === progress.total;
    })
    .sort((a, b) => b.scheduleDate.localeCompare(a.scheduleDate));

  renderBatchTrackerSection("batchTrackerWorking", workingBatches, "No working batches.");
  renderBatchTrackerSection("batchTrackerCompleted", completedBatches, "No completed batches.", true);
}

async function loadDailyReport() {
  const today = getTodayIsoDate();
  const todayDate = dateOnly(new Date());
  const from = toIsoDate(addDays(todayDate, -3650));
  const scheduleRes = await fetch(`/schedule?from=${from}&to=${today}`);

  if (!scheduleRes.ok) {
    showMessage("Could not load daily report.", "error");
    return;
  }

  const rows = await scheduleRes.json();
  const scheduleMap = new Map(rows.map(row => [row.schedule_date, row.tasks || ""]));
  const payload = parseSchedulePayload(scheduleMap.get(today));
  const projectedKitchenTasks = buildAdminProjectedTasksByDate(rows, todayDate, todayDate).get(today) || [];
  const projectedProcessingTasks = buildAdminProjectedTasksByDate(rows, todayDate, todayDate, parsed => parsed.processingTasks).get(today) || [];
  const events = buildAdminEventsByDate(rows, todayDate, todayDate).get(today) || [];
  const batches = [
    ...payload.batchHijnx.map(batch => ({ label: "Hijnx", ...batch })),
    ...payload.batchSb.map(batch => ({ label: "SB", ...batch }))
  ];
  const workingBatches = getWorkingBatchesFromRows(rows);

  document.getElementById("dailyReportTitle").textContent = `Daily Report - ${formatDisplayDate(today)}`;
  closeDailyReportFocus();

  const grid = document.getElementById("dailyReportGrid");
  grid.innerHTML = "";

  const cards = [
    createDailyReportCard({
      title: "Production Batches",
      count: batches.length,
      note: batches.length ? "Tap to review batch details" : "No batches scheduled",
      className: "batches",
      onFocus: () => showDailyReportFocus("Production Batches", body => {
        if (!batches.length) {
          body.appendChild(createFocusEmpty("No production batches."));
          return;
        }
        batches.forEach(batch => appendBatchDetail(body, batch));
      })
    }),
    createDailyReportCard({
      title: "Kitchen Tasks",
      count: countGroupedTasks(projectedKitchenTasks),
      note: projectedKitchenTasks.length ? "Tap to review assignments" : "No kitchen tasks scheduled",
      className: "kitchen",
      onFocus: () => showDailyReportFocus("Kitchen Tasks", body => appendTaskFocusDetails(body, projectedKitchenTasks, "No kitchen tasks scheduled."))
    }),
    createDailyReportCard({
      title: "Processing Tasks",
      count: countGroupedTasks(projectedProcessingTasks),
      note: projectedProcessingTasks.length ? "Tap to review assignments" : "No processing tasks scheduled",
      className: "processing",
      onFocus: () => showDailyReportFocus("Processing Tasks", body => appendTaskFocusDetails(body, projectedProcessingTasks, "No processing tasks scheduled."))
    }),
    createDailyReportCard({
      title: "Events",
      count: events.length,
      note: events.length ? "Tap to review event details" : "No events scheduled",
      className: "events",
      onFocus: () => showDailyReportFocus("Events", body => appendFocusLines(body, events, event => {
        const timeText = event.start && event.end ? ` ${event.start}-${event.end}` : "";
        return `${event.title}${timeText} - ${event.location} - ${event.company}`;
      }, "No events scheduled."))
    }),
    createDailyReportCard({
      title: "Test Pick Ups",
      count: payload.testPickups.length,
      note: payload.testPickups.length ? "Tap to review pickup details" : "No test pick ups scheduled",
      className: "pickups",
      onFocus: () => showDailyReportFocus("Test Pick Ups", body => appendFocusLines(body, payload.testPickups, pickup =>
        `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`,
      "No test pick ups."))
    })
  ];

  cards.forEach(card => grid.appendChild(card));
  renderDailyWorkingBatches(workingBatches);
}

function renderAdminCalendar(gridStart) {
  const calendar = document.getElementById("adminCalendar");
  calendar.innerHTML = "";

  dayNames.forEach(dayName => {
    const header = document.createElement("div");
    header.className = "admin-day-name";
    header.textContent = dayName;
    calendar.appendChild(header);
  });

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const isoDate = toIsoDate(date);
    const cell = document.createElement("div");
    cell.className = "admin-calendar-day";
    if (date.getDay() === 0 || date.getDay() === 6) {
      cell.classList.add("weekend");
    }
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-label", `View details for ${formatDisplayDate(isoDate)}`);

    const dateLabel = document.createElement("div");
    dateLabel.className = "admin-calendar-date";
    dateLabel.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
    cell.appendChild(dateLabel);

    const scheduleDay = adminActiveScheduleByDate.get(isoDate) || { batchHijnx: [], batchSb: [], events: [], tasks: [], testPickups: [], processingTasks: [] };
    const activeEvents = scheduleDay.events || [];
    const activeDeliveries = adminExpectedDeliveriesByDate.get(isoDate) || [];

    appendEventList(cell, activeEvents);

    appendBatchList(cell, scheduleDay);
    appendTestPickupList(cell, scheduleDay);
    cell.addEventListener("click", () => {
      renderAdminFocusedScheduleDay(isoDate, scheduleDay, activeDeliveries);
    });
    cell.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        renderAdminFocusedScheduleDay(isoDate, scheduleDay, activeDeliveries);
      }
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", event => {
      event.stopPropagation();
      editScheduleDay(isoDate);
    });
    cell.appendChild(editButton);

    calendar.appendChild(cell);
  }
}

function refreshScheduleTaskRows() {
  document.querySelectorAll(".schedule-task-row").forEach((row, index, rows) => {
    row.querySelector(".schedule-task-order").textContent = `${index + 1}.`;
    row.querySelector(".schedule-task-up").disabled = index === 0;
    row.querySelector(".schedule-task-down").disabled = index === rows.length - 1;
    updateScheduleTaskRemaining(row);
  });
}

function ensureScheduleEmployeeDatalist() {
  let datalist = document.getElementById("scheduleAssignmentEmployees");
  if (datalist) return datalist;

  datalist = document.createElement("datalist");
  datalist.id = "scheduleAssignmentEmployees";

  ["Open", ...window.employeeNames].forEach(employee => {
    const option = document.createElement("option");
    option.value = employee;
    datalist.appendChild(option);
  });

  document.body.appendChild(datalist);
  return datalist;
}

function createEmployeeInput(value = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "schedule-assignment-employee";
  input.placeholder = "Person";
  input.setAttribute("list", ensureScheduleEmployeeDatalist().id);
  input.value = value;
  return input;
}

function addScheduleAssignment(taskRow, value = {}) {
  const assignments = taskRow.querySelector(".schedule-assignment-rows");
  const row = document.createElement("div");
  row.className = "schedule-assignment-row";

  const days = Math.max(1, Number.parseInt(taskRow.querySelector(".schedule-task-days").value, 10) || 1);
  const daySelect = document.createElement("select");
  daySelect.className = "schedule-assignment-day";
  for (let index = 0; index < days; index += 1) {
    const option = document.createElement("option");
    option.value = String(index);
    option.text = `Day ${index + 1}`;
    daySelect.appendChild(option);
  }
  daySelect.value = String(Math.min(days - 1, Math.max(0, Number.parseInt(value.dayIndex, 10) || 0)));
  row.appendChild(daySelect);

  const employee = createEmployeeInput(value.employee || "");
  row.appendChild(employee);

  const hours = document.createElement("input");
  hours.type = "number";
  hours.className = "schedule-assignment-hours";
  hours.min = "0";
  hours.step = "0.25";
  hours.placeholder = "Hours";
  hours.value = value.hours || "";
  hours.addEventListener("input", () => {
    markGeneratedTaskPlanned(taskRow);
    updateScheduleTaskRemaining(taskRow);
  });
  row.appendChild(hours);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    updateScheduleTaskRemaining(taskRow);
  });
  row.appendChild(removeButton);

  assignments.appendChild(row);
  updateScheduleTaskRemaining(taskRow);
}

function refreshScheduleAssignmentDays(taskRow) {
  const days = Math.max(1, Number.parseInt(taskRow.querySelector(".schedule-task-days").value, 10) || 1);
  taskRow.querySelectorAll(".schedule-assignment-day").forEach(select => {
    const selected = Math.min(days - 1, Math.max(0, Number.parseInt(select.value, 10) || 0));
    select.innerHTML = "";
    for (let index = 0; index < days; index += 1) {
      const option = document.createElement("option");
      option.value = String(index);
      option.text = `Day ${index + 1}`;
      select.appendChild(option);
    }
    select.value = String(selected);
  });
}

function updateScheduleTaskRemaining(taskRow) {
  const total = Math.max(0, Number.parseFloat(taskRow.querySelector(".schedule-task-hours").value) || 0);
  const assigned = Array.from(taskRow.querySelectorAll(".schedule-assignment-hours"))
    .reduce((sum, input) => sum + (Number.parseFloat(input.value) || 0), 0);
  const remaining = Math.max(0, total - assigned);
  const summary = taskRow.querySelector(".schedule-task-remaining");
  if (!summary) return;

  summary.textContent = total
    ? `${formatTaskHours(remaining)} remaining`
    : "Enter total hours";
  summary.classList.toggle("over-assigned", assigned > total && total > 0);
  if (assigned > total && total > 0) {
    summary.textContent = `${formatTaskHours(assigned - total)} over assigned`;
  }
}

function createScheduleItemSelect(value = "") {
  const select = document.createElement("select");
  select.className = "schedule-task-item";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.text = "Select Item";
  select.appendChild(placeholder);

  allItems.forEach(item => {
    const option = document.createElement("option");
    option.value = item.name;
    option.text = item.name;
    select.appendChild(option);
  });

  if (value && !allItems.some(item => item.name === value)) {
    const existingOption = document.createElement("option");
    existingOption.value = value;
    existingOption.text = value;
    select.appendChild(existingOption);
  }

  select.value = value;
  return select;
}

function renderScheduleTaskSelect(select, itemName, selectedTask = "") {
  const itemId = getItemIdByName(itemName);
  const allowedTaskIds = (itemTaskOptionsByItemId[itemId] || []).map(String);
  const allowedTaskNames = allowedTaskIds
    .map(getTaskNameById)
    .filter(Boolean);

  select.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.text = itemName ? "Select Task" : "Select Item First";
  select.appendChild(placeholder);

  allowedTaskNames.forEach(taskName => {
    const option = document.createElement("option");
    option.value = taskName;
    option.text = taskName;
    select.appendChild(option);
  });

  if (selectedTask && !allowedTaskNames.includes(selectedTask)) {
    const existingOption = document.createElement("option");
    existingOption.value = selectedTask;
    existingOption.text = selectedTask;
    select.appendChild(existingOption);
  }

  select.value = selectedTask && Array.from(select.options).some(option => option.value === selectedTask)
    ? selectedTask
    : "";
}

function createScheduleTaskField(labelText, control) {
  const field = document.createElement("div");
  field.className = "schedule-task-field";

  const label = document.createElement("label");
  label.textContent = labelText;
  field.appendChild(label);
  field.appendChild(control);

  return field;
}

function formatEstimatedHours(value) {
  const hours = Number(value) || 0;
  if (!hours) return "";
  return String(Math.round(hours * 100) / 100);
}

async function autoFillScheduleTaskHours(row, force = false) {
  if (!force && row.dataset.hoursOverridden === "true") return;

  const unitsInput = row.querySelector(".schedule-task-units");
  const itemSelect = row.querySelector(".schedule-task-item");
  const taskSelect = row.querySelector(".schedule-task-input");
  const hoursInput = row.querySelector(".schedule-task-hours");
  if (!unitsInput || !itemSelect || !taskSelect || !hoursInput) return;

  const units = Number.parseFloat(unitsInput.value);
  const item = itemSelect.value;
  const task = taskSelect.value;
  if (!Number.isFinite(units) || units <= 0 || !item || !task) return;

  const requestId = String(Date.now());
  row.dataset.rateRequestId = requestId;

  const params = new URLSearchParams({ item, task });
  const res = await adminFetch(`/admin/item-task-rate?${params.toString()}`);
  if (!res.ok || row.dataset.rateRequestId !== requestId) return;

  const rate = await res.json();
  const unitsPerHour = Number(rate.units_per_hour) || 0;
  if (unitsPerHour <= 0) return;

  hoursInput.value = formatEstimatedHours(units / unitsPerHour);
  row.dataset.hoursOverridden = "false";
  updateScheduleTaskRemaining(row);
  if (row.classList.contains("batch-generated-task")) {
    const assignment = getFirstPlannerAssignment(row);
    if (assignment) assignment.querySelector(".schedule-assignment-hours").value = hoursInput.value;
    renderBatchTaskPlanner();
  }
}

function addScheduleTask(value = "", daysValue = 1, rowsId = "scheduleTaskRows") {
  const rows = document.getElementById(rowsId);
  const row = document.createElement("div");
  row.className = "schedule-task-row";
  row.dataset.rowsId = rowsId;
  const task = value && typeof value === "object" ? value : { text: value, days: daysValue };
  row.dataset.hoursOverridden = task.hoursOverridden ? "true" : "false";
  row.dataset.completedDates = JSON.stringify(Array.isArray(task.completedDates) ? task.completedDates.filter(isIsoDate) : []);
  if (task.autoGenerated) {
    row.classList.add("batch-generated-task");
    row.dataset.autoGenerated = "true";
    row.dataset.generatedTaskPlanned = task.generatedTaskPlanned ? "true" : "false";
    row.dataset.sourceBatchKey = task.sourceBatchKey || "";
    row.dataset.sourceBatchLabel = task.sourceBatchLabel || "";
    row.dataset.sourceTaskOrder = task.sourceTaskOrder === null || task.sourceTaskOrder === undefined ? "" : String(task.sourceTaskOrder);
  }

  const order = document.createElement("span");
  order.className = "schedule-task-order";
  row.appendChild(order);

  const itemSelect = createScheduleItemSelect(task.item || "");
  row.appendChild(createScheduleTaskField("Item", itemSelect));

  const input = document.createElement("select");
  input.className = "schedule-task-input";
  renderScheduleTaskSelect(input, itemSelect.value, task.text || "");
  itemSelect.addEventListener("change", () => {
    renderScheduleTaskSelect(input, itemSelect.value);
    row.dataset.hoursOverridden = "false";
    autoFillScheduleTaskHours(row, true);
  });
  row.appendChild(createScheduleTaskField("Task", input));

  const units = document.createElement("input");
  units.type = "number";
  units.className = "schedule-task-units";
  units.min = "0";
  units.step = "1";
  units.value = task.units || "";
  units.placeholder = "Units";
  units.title = "Units";
  units.addEventListener("input", () => {
    row.dataset.hoursOverridden = "false";
    autoFillScheduleTaskHours(row, true);
  });
  row.appendChild(createScheduleTaskField("Units", units));

  const totalHours = document.createElement("input");
  totalHours.type = "number";
  totalHours.className = "schedule-task-hours";
  totalHours.min = "0";
  totalHours.step = "0.25";
  totalHours.value = task.totalHours || "";
  totalHours.placeholder = "Total hours";
  totalHours.title = "Total hours";
  totalHours.addEventListener("input", () => {
    row.dataset.hoursOverridden = "true";
    markGeneratedTaskPlanned(row);
    updateScheduleTaskRemaining(row);
  });
  row.appendChild(createScheduleTaskField("Hours", totalHours));

  const scheduleDate = document.createElement("input");
  scheduleDate.type = "date";
  scheduleDate.className = "schedule-task-date";
  scheduleDate.value = isIsoDate(task.scheduleDate)
    ? task.scheduleDate
    : document.getElementById("schedule_edit_date").value || "";
  row.appendChild(createScheduleTaskField("Task Date", scheduleDate));

  input.addEventListener("change", () => {
    row.dataset.hoursOverridden = "false";
    autoFillScheduleTaskHours(row, true);
  });

  const days = document.createElement("input");
  days.type = "number";
  days.className = "schedule-task-days";
  days.min = "1";
  days.step = "1";
  days.value = String(Math.max(1, Number.parseInt(task.days, 10) || 1));
  days.title = "Days";
  days.addEventListener("input", () => {
    refreshScheduleAssignmentDays(row);
    updateScheduleTaskRemaining(row);
  });
  row.appendChild(createScheduleTaskField("Days", days));

  const taskActions = document.createElement("div");
  taskActions.className = "schedule-task-actions";

  const upButton = document.createElement("button");
  upButton.type = "button";
  upButton.className = "schedule-task-up";
  upButton.textContent = "Up";
  upButton.addEventListener("click", () => {
    if (row.previousElementSibling) {
      rows.insertBefore(row, row.previousElementSibling);
      refreshScheduleTaskRows();
    }
  });
  taskActions.appendChild(upButton);

  const downButton = document.createElement("button");
  downButton.type = "button";
  downButton.className = "schedule-task-down";
  downButton.textContent = "Down";
  downButton.addEventListener("click", () => {
    if (row.nextElementSibling) {
      rows.insertBefore(row.nextElementSibling, row);
      refreshScheduleTaskRows();
    }
  });
  taskActions.appendChild(downButton);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!rows.children.length) {
      addScheduleTask("", 1, rowsId);
      return;
    }
    refreshScheduleTaskRows();
  });
  taskActions.appendChild(removeButton);
  row.appendChild(taskActions);

  const assignmentPanel = document.createElement("div");
  assignmentPanel.className = "schedule-assignment-panel";

  if (task.autoGenerated && task.sourceBatchLabel) {
    const generatedNote = document.createElement("div");
    generatedNote.className = "schedule-generated-note";
    generatedNote.textContent = `Generated from ${task.sourceBatchLabel}`;
    assignmentPanel.appendChild(generatedNote);
  }

  const assignmentHeader = document.createElement("div");
  assignmentHeader.className = "schedule-assignment-header";
  const remaining = document.createElement("span");
  remaining.className = "schedule-task-remaining";
  assignmentHeader.appendChild(remaining);

  const addAssignmentButton = document.createElement("button");
  addAssignmentButton.type = "button";
  addAssignmentButton.textContent = "Add Person Hours";
  addAssignmentButton.addEventListener("click", () => addScheduleAssignment(row));
  assignmentHeader.appendChild(addAssignmentButton);
  assignmentPanel.appendChild(assignmentHeader);

  const assignmentRows = document.createElement("div");
  assignmentRows.className = "schedule-assignment-rows";
  assignmentPanel.appendChild(assignmentRows);
  row.appendChild(assignmentPanel);

  rows.appendChild(row);
  if (Array.isArray(task.assignments)) {
    task.assignments.forEach(assignment => addScheduleAssignment(row, assignment));
  }
  refreshScheduleTaskRows();
  return input;
}

function populateScheduleTaskRows(tasks, rowsId = "scheduleTaskRows", addEmptyRow = true) {
  const rows = document.getElementById(rowsId);
  rows.innerHTML = "";

  const lines = Array.isArray(tasks) ? tasks : getScheduleTasks(tasks);
  if (!lines.length) {
    if (addEmptyRow) addScheduleTask("", 1, rowsId);
    return;
  }

  lines.forEach(task => addScheduleTask(task, 1, rowsId));
}

function refreshTestPickupRows() {
  document.querySelectorAll(".test-pickup-row").forEach((row, index) => {
    row.querySelector(".schedule-task-order").textContent = `${index + 1}.`;
  });
}

function addTestPickupSelectedItem(container, itemName) {
  const item = String(itemName || "").trim();
  if (!item) return;

  const existingItems = Array.from(container.querySelectorAll(".test-pickup-selected-item"))
    .map(element => element.dataset.itemName);
  if (existingItems.includes(item)) return;

  const chip = document.createElement("span");
  chip.className = "test-pickup-selected-item";
  chip.dataset.itemName = item;
  chip.append(document.createTextNode(item));

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => chip.remove());
  chip.appendChild(removeButton);

  container.appendChild(chip);
}

function addTestPickup(value = { time: "", items: [] }) {
  const rows = document.getElementById("testPickupRows");
  const row = document.createElement("div");
  row.className = "test-pickup-row";

  const order = document.createElement("span");
  order.className = "schedule-task-order";
  row.appendChild(order);

  const timeInput = document.createElement("input");
  timeInput.type = "text";
  timeInput.className = "test-pickup-time";
  timeInput.placeholder = "00:00";
  timeInput.inputMode = "numeric";
  timeInput.maxLength = 5;
  timeInput.pattern = "([01]\\d|2[0-3]):[0-5]\\d";
  timeInput.title = "Enter time as HH:MM";
  timeInput.value = value.time || "";
  timeInput.addEventListener("input", () => {
    timeInput.value = timeInput.value
      .replace(/[^\d:]/g, "")
      .replace(/^(\d{2})(\d)/, "$1:$2")
      .slice(0, 5);
  });
  row.appendChild(timeInput);

  const itemPicker = document.createElement("div");
  itemPicker.className = "test-pickup-item-picker";

  const itemSelect = document.createElement("select");
  itemSelect.className = "test-pickup-item-select";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.text = "Select item";
  itemSelect.appendChild(placeholder);

  getAllProductionBatchOptions().forEach(itemName => {
    const option = document.createElement("option");
    option.value = itemName;
    option.text = itemName;
    itemSelect.appendChild(option);
  });
  itemPicker.appendChild(itemSelect);

  const selectedItems = document.createElement("div");
  selectedItems.className = "test-pickup-selected-items";

  const addItemButton = document.createElement("button");
  addItemButton.type = "button";
  addItemButton.textContent = "Add Item";
  addItemButton.addEventListener("click", () => {
    addTestPickupSelectedItem(selectedItems, itemSelect.value);
    itemSelect.value = "";
  });
  itemPicker.appendChild(addItemButton);
  itemPicker.appendChild(selectedItems);

  if (Array.isArray(value.items)) {
    value.items.forEach(item => addTestPickupSelectedItem(selectedItems, item));
  }

  row.appendChild(itemPicker);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    refreshTestPickupRows();
  });
  row.appendChild(removeButton);

  rows.appendChild(row);
  refreshTestPickupRows();
  return timeInput;
}

function populateTestPickupRows(testPickups) {
  const rows = document.getElementById("testPickupRows");
  rows.innerHTML = "";
  testPickups.forEach(pickup => addTestPickup(pickup));
}

function getTestPickupValues() {
  return Array.from(document.querySelectorAll(".test-pickup-row"))
    .map(row => ({
      time: row.querySelector(".test-pickup-time").value.trim(),
      items: Array.from(row.querySelectorAll(".test-pickup-selected-item"))
        .map(item => item.dataset.itemName)
        .filter(Boolean)
    }))
    .filter(pickup => pickup.time || pickup.items.length);
}

function getProcessingTaskValues() {
  return getScheduleTaskValues("#processingTaskRows .schedule-task-row");
}

function getScheduleTaskValues(selector) {
  return Array.from(document.querySelectorAll(selector))
    .map(row => {
      const days = Math.max(1, Number.parseInt(row.querySelector(".schedule-task-days").value, 10) || 1);
      return {
        item: row.querySelector(".schedule-task-item").value.trim(),
        text: row.querySelector(".schedule-task-input").value.trim(),
        units: Math.max(0, Number.parseFloat(row.querySelector(".schedule-task-units").value) || 0),
        scheduleDate: row.querySelector(".schedule-task-date").value || "",
        totalHours: Math.max(0, Number.parseFloat(row.querySelector(".schedule-task-hours").value) || 0),
        days,
        assignments: Array.from(row.querySelectorAll(".schedule-assignment-row"))
          .map(assignmentRow => ({
            dayIndex: Math.max(0, Number.parseInt(assignmentRow.querySelector(".schedule-assignment-day").value, 10) || 0),
            employee: assignmentRow.querySelector(".schedule-assignment-employee").value.trim(),
            hours: Math.max(0, Number.parseFloat(assignmentRow.querySelector(".schedule-assignment-hours").value) || 0)
          }))
          .filter(assignment => assignment.dayIndex < days && assignment.employee && assignment.hours > 0),
        autoGenerated: row.dataset.autoGenerated === "true",
        generatedTaskPlanned: row.dataset.generatedTaskPlanned === "true",
        sourceBatchKey: row.dataset.sourceBatchKey || "",
        sourceBatchLabel: row.dataset.sourceBatchLabel || "",
        sourceTaskOrder: row.dataset.sourceTaskOrder === "" ? null : Number.parseInt(row.dataset.sourceTaskOrder, 10),
        hoursOverridden: row.dataset.hoursOverridden === "true",
        completedDates: JSON.parse(row.dataset.completedDates || "[]").filter(isIsoDate)
      };
    })
    .filter(task => task.text);
}

function buildSchedulePayload(includeTasks = true) {
  const events = getEventValues();
  validateEvents(events);

  const tasks = includeTasks
    ? getScheduleTaskValues("#scheduleTaskRows .schedule-task-row")
    : [];
  const processingTasks = includeTasks ? getProcessingTaskValues() : [];

  const invalidTask = [...tasks, ...processingTasks].find(task =>
    (!task.autoGenerated && task.totalHours <= 0) ||
    task.assignments.reduce((sum, assignment) => sum + assignment.hours, 0) > task.totalHours
  );
  if (invalidTask) {
    throw new Error("Each manually entered task needs total hours, and assigned person hours cannot exceed the task total.");
  }

  const testPickups = includeTasks ? getTestPickupValues() : [];
  const invalidPickup = testPickups.find(pickup => !/^([01]\d|2[0-3]):[0-5]\d$/.test(pickup.time) || !pickup.items.length);
  if (invalidPickup) {
    throw new Error("Each Test Pick Up needs a valid HH:MM time and at least one selected item.");
  }

  return JSON.stringify({
    batchHijnx: getBatchValues("hijnx"),
    batchSb: getBatchValues("sb"),
    events,
    tasks,
    testPickups,
    processingTasks
  });
}

function editScheduleDay(isoDate) {
  const payload = parseSchedulePayload(adminScheduleRows.get(isoDate));
  const isWeekendDay = isWeekendIsoDate(isoDate);
  const taskSections = document.querySelectorAll(".schedule-task-section, .pickup-group, .processing-group");

  document.getElementById("schedule_edit_date").value = isoDate;
  document.getElementById("scheduleEditLabel").textContent = formatDisplayDate(isoDate);
  populateEventRows(payload.events);
  populateBatchRows("hijnx", payload.batchHijnx);
  populateBatchRows("sb", payload.batchSb);
  taskSections.forEach(section => {
    section.hidden = isWeekendDay;
  });
  populateScheduleTaskRows(isWeekendDay ? "" : adminScheduleRows.get(isoDate) || "");
  populateTestPickupRows(isWeekendDay ? [] : payload.testPickups);
  populateScheduleTaskRows(isWeekendDay ? [] : payload.processingTasks, "processingTaskRows", false);
  if (!isWeekendDay) {
    syncGeneratedBatchTasksFromBatches();
  }
  document.getElementById("scheduleEditor").classList.add("active");
  showMessage("");
  getBatchRows("hijnx").querySelector(".batch-input").focus();
}

function cancelScheduleEdit() {
  document.getElementById("scheduleEditor").classList.remove("active");
  document.getElementById("schedule_edit_date").value = "";
  document.getElementById("eventRows").innerHTML = "";
  getBatchRows("hijnx").innerHTML = "";
  getBatchRows("sb").innerHTML = "";
  document.getElementById("scheduleTaskRows").innerHTML = "";
  document.getElementById("testPickupRows").innerHTML = "";
  document.getElementById("processingTaskRows").innerHTML = "";
  const planner = document.getElementById("batchTaskPlanner");
  if (planner) {
    planner.innerHTML = "";
    planner.hidden = true;
  }
  document.querySelectorAll(".schedule-task-section, .pickup-group, .processing-group").forEach(section => {
    section.hidden = false;
  });
}

async function saveScheduleDay() {
  const scheduleDate = document.getElementById("schedule_edit_date").value;
  let tasks;

  try {
    tasks = buildSchedulePayload(!isWeekendIsoDate(scheduleDate));
  } catch (err) {
    showMessage(err.message, "error");
    return;
  }

  if (!scheduleDate) return;

  const res = await adminFetch(`/admin/schedule/${scheduleDate}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks })
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Schedule save failed: " + text, "error");
    return;
  }

  cancelScheduleEdit();
  showMessage("Calendar day updated.", "success");
  await loadAdminCalendar();
}

function resetOrderedForm() {
  document.getElementById("ordered_date_ordered").value = toIsoDate(new Date());
  document.getElementById("ordered_expected_delivery_date").value = "";
  document.getElementById("ordered_item_supplier").value = "";
  document.getElementById("ordered_department").value = "";
  document.getElementById("ordered_import_pdf").value = "";
  document.getElementById("orderedImportResult").textContent = "";
  document.getElementById("orderedItemRows").innerHTML = "";
  addOrderedItemRow();
}

function addOrderedItemRow(value = { item_name: "", package_qty: "" }) {
  const rows = document.getElementById("orderedItemRows");
  const row = document.createElement("div");
  row.className = "ordered-item-row";

  const itemName = document.createElement("input");
  itemName.type = "text";
  itemName.className = "ordered-item-name";
  itemName.placeholder = "Item Name";
  itemName.value = value.item_name || "";
  row.appendChild(itemName);

  const packageQty = document.createElement("input");
  packageQty.type = "number";
  packageQty.className = "ordered-item-package-qty";
  packageQty.min = "0";
  packageQty.step = "1";
  packageQty.placeholder = "Package QTY";
  packageQty.value = value.package_qty || "";
  row.appendChild(packageQty);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!rows.children.length) {
      addOrderedItemRow();
    }
  });
  row.appendChild(removeButton);

  rows.appendChild(row);
  return itemName;
}

function getOrderedItemRows() {
  return Array.from(document.querySelectorAll(".ordered-item-row"))
    .map(row => ({
      item_name: row.querySelector(".ordered-item-name").value.trim(),
      package_qty: row.querySelector(".ordered-item-package-qty").value
    }))
    .filter(item => item.item_name || item.package_qty);
}

function resetAdminOrderRequestForm() {
  document.getElementById("admin_request_date").value = toIsoDate(new Date());
  document.getElementById("admin_requester_name").value = "";
  document.getElementById("admin_request_department").value = "";
  document.getElementById("admin_request_item_needed").value = "";
  document.getElementById("admin_request_qty_needed").value = "";
  document.getElementById("admin_request_suggested_retailer").value = "";
}

function setupAdminTimeInput(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.pattern = "([01]\\d|2[0-3]):[0-5]\\d";
  input.title = "Time as HH:MM";
  input.addEventListener("input", () => {
    input.value = input.value
      .replace(/[^\d:]/g, "")
      .replace(/^(\d{2})(\d)/, "$1:$2")
      .slice(0, 5);
  });
}

function resetAdminManualReceivedForm() {
  const dateOrdered = document.getElementById("admin_manual_received_date_ordered");
  if (!dateOrdered) return;

  const today = toIsoDate(new Date());
  dateOrdered.value = today;
  document.getElementById("admin_manual_received_expected_delivery_date").value = today;
  document.getElementById("admin_manual_received_item_name").value = "";
  document.getElementById("admin_manual_received_package_qty").value = "";
  document.getElementById("admin_manual_received_units_per_package").value = "";
  document.getElementById("admin_manual_received_item_supplier").value = "";
  document.getElementById("admin_manual_received_department").value = "";
  document.getElementById("admin_manual_received_date").value = today;
  document.getElementById("admin_manual_received_time").value = "";
  document.getElementById("admin_manual_received_location").value = "";
}

function openAdminManualReceivedWindow() {
  const modal = document.getElementById("adminManualReceivedWindow");
  if (!modal) return;

  modal.hidden = false;
  document.body.style.overflow = "hidden";
  const firstField = document.getElementById("admin_manual_received_item_name");
  if (firstField) firstField.focus();
}

function closeAdminManualReceivedWindow() {
  const modal = document.getElementById("adminManualReceivedWindow");
  if (!modal) return;

  modal.hidden = true;
  document.body.style.overflow = "";
}

function isAdminMobileOrderedView() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function toggleAdminMobileOrderedPanel(button) {
  const panel = button.closest(".ordered-card, .ordered-section");
  if (!panel) return;

  const willFocus = !panel.classList.contains("mobile-focused");
  document
    .querySelectorAll("#orderedPanel .ordered-card.mobile-focused, #orderedPanel .ordered-section.mobile-focused")
    .forEach(openPanel => {
      if (openPanel !== panel) openPanel.classList.remove("mobile-focused");
    });

  panel.classList.toggle("mobile-focused", willFocus);

  if (willFocus && isAdminMobileOrderedView()) {
    panel.scrollIntoView({ block: "start", behavior: "smooth" });
    const firstField = panel.querySelector("input, select, textarea, button:not(.ordered-mobile-toggle)");
    if (firstField) firstField.focus({ preventScroll: true });
  }
}

async function loadOrderedItems() {
  const res = await fetch("/ordered-items");

  if (!res.ok) {
    showMessage("Could not load ordered items.", "error");
    return;
  }

  allOrderedItems = await res.json();
  renderOrderedItemsTable();
}

async function loadOrderRequests() {
  const res = await fetch("/order-requests");

  if (!res.ok) {
    showMessage("Could not load item requests.", "error");
    return;
  }

  allOrderRequests = await res.json();
  renderAdminOrderRequests();
}

async function loadOrderedAdminData() {
  await Promise.all([
    loadOrderRequests(),
    loadOrderedItems()
  ]);
}

async function saveAdminOrderRequest() {
  const payload = {
    request_date: document.getElementById("admin_request_date").value,
    requester_name: document.getElementById("admin_requester_name").value,
    department: document.getElementById("admin_request_department").value,
    item_needed: document.getElementById("admin_request_item_needed").value,
    qty_needed: document.getElementById("admin_request_qty_needed").value,
    suggested_retailer: document.getElementById("admin_request_suggested_retailer").value
  };

  const res = await fetch("/order-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Request save failed: " + text, "error");
    return;
  }

  resetAdminOrderRequestForm();
  showMessage("Item request submitted.", "success");
  await loadOrderRequests();
}

async function saveAdminManualReceivedItem() {
  const receivedTime = document.getElementById("admin_manual_received_time").value.trim();
  if (receivedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(receivedTime)) {
    showMessage("Received time must use HH:MM format.", "error");
    return;
  }

  const payload = {
    date_ordered: document.getElementById("admin_manual_received_date_ordered").value,
    expected_delivery_date: document.getElementById("admin_manual_received_expected_delivery_date").value,
    item_name: document.getElementById("admin_manual_received_item_name").value,
    package_qty: document.getElementById("admin_manual_received_package_qty").value,
    units_per_package: document.getElementById("admin_manual_received_units_per_package").value,
    item_supplier: document.getElementById("admin_manual_received_item_supplier").value,
    department: document.getElementById("admin_manual_received_department").value,
    received_date: document.getElementById("admin_manual_received_date").value,
    received_time: receivedTime,
    received_location: document.getElementById("admin_manual_received_location").value
  };

  const res = await fetch("/ordered-items/received", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Received item save failed: " + text, "error");
    return;
  }

  resetAdminManualReceivedForm();
  closeAdminManualReceivedWindow();
  showMessage("Received item added.", "success");
  await loadOrderedItems();
}

function renderAdminOrderRequests() {
  const container = document.getElementById("adminOrderRequests");
  const count = document.getElementById("adminOrderRequestsCount");
  const mobileCount = document.getElementById("adminOrderRequestsMobileCount");
  const openRequests = allOrderRequests.filter(request => !request.ordered_item_id);
  container.innerHTML = "";
  if (count) {
    count.textContent = `${openRequests.length} open`;
  }
  if (mobileCount) {
    mobileCount.textContent = `${openRequests.length} open`;
  }

  if (!openRequests.length) {
    const empty = document.createElement("div");
    empty.className = "message";
    empty.textContent = "No item requests yet.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";
  const labels = [
    "Date",
    "Name",
    "Department",
    "Item Needed",
    "QTY Needed",
    "Suggested Retailer",
    "Status",
    "Ordered"
  ];
  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  openRequests.forEach(request => {
    const row = document.createElement("tr");
    appendCell(row, request.request_date, labels[0]);
    appendCell(row, request.requester_name, labels[1]);
    appendCell(row, request.department || "", labels[2]);
    appendCell(row, request.item_needed, labels[3]);
    appendCell(row, request.qty_needed, labels[4]);
    appendCell(row, request.suggested_retailer || "", labels[5]);
    appendCell(row, request.status, labels[6]);

    const orderedCell = document.createElement("td");
    orderedCell.dataset.label = labels[7];
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(request.ordered_item_id);
    checkbox.disabled = Boolean(request.ordered_item_id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        showRequestOrderForm(request, orderedCell, checkbox);
      }
    });
    orderedCell.appendChild(checkbox);
    row.appendChild(orderedCell);

    appendMobileSummaryRow(table, labels, request.item_needed, row);
    table.appendChild(row);
  });

  container.appendChild(table);
}

function createOrderField(labelText, input) {
  const field = document.createElement("div");
  const label = document.createElement("label");
  label.textContent = labelText;
  field.appendChild(label);
  field.appendChild(input);
  return field;
}

function showRequestOrderForm(request, cell, checkbox) {
  const existingForm = cell.querySelector(".request-order-form");
  if (existingForm) {
    existingForm.classList.add("active");
    return;
  }

  const form = document.createElement("div");
  form.className = "request-order-form active";

  const dateOrdered = document.createElement("input");
  dateOrdered.type = "date";
  dateOrdered.value = toIsoDate(new Date());
  form.appendChild(createOrderField("Date Ordered", dateOrdered));

  const packageQty = document.createElement("input");
  packageQty.type = "number";
  packageQty.min = "1";
  packageQty.step = "1";
  packageQty.value = request.qty_needed || "";
  form.appendChild(createOrderField("Unit-package QTY Ordered", packageQty));

  const unitsPerPackage = document.createElement("input");
  unitsPerPackage.type = "number";
  unitsPerPackage.min = "0";
  unitsPerPackage.step = "1";
  form.appendChild(createOrderField("Units Per Package", unitsPerPackage));

  const retailer = document.createElement("input");
  retailer.type = "text";
  retailer.value = request.suggested_retailer || "";
  form.appendChild(createOrderField("Retailer", retailer));

  const expectedDelivery = document.createElement("input");
  expectedDelivery.type = "date";
  form.appendChild(createOrderField("Expected Delivery", expectedDelivery));

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save Ordered";
  saveButton.addEventListener("click", () => markRequestOrdered(request.id, {
    date_ordered: dateOrdered.value,
    package_qty: packageQty.value,
    units_per_package: unitsPerPackage.value,
    retailer: retailer.value,
    expected_delivery_date: expectedDelivery.value
  }));
  form.appendChild(saveButton);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    checkbox.checked = false;
    form.remove();
  });
  form.appendChild(cancelButton);

  cell.appendChild(form);
  expectedDelivery.focus();
}

async function markRequestOrdered(requestId, payload) {
  const res = await adminFetch(`/admin/order-requests/${requestId}/order`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Could not mark request ordered: " + text, "error");
    return;
  }

  showMessage("Item request marked ordered and added to expected deliveries.", "success");
  await loadOrderedAdminData();
}

function renderOrderedItemsTable() {
  renderExpectedDeliveriesTable();
  renderNeedsDeliveryDateTable();
  renderReceivedDeliveriesTable();
}

function appendOrderedReviewMeta(container, labelText, value) {
  if (value === undefined || value === null || value === "") return;

  const meta = document.createElement("div");
  const label = document.createElement("b");
  label.textContent = labelText;
  meta.appendChild(label);
  meta.appendChild(document.createTextNode(value));
  container.appendChild(meta);
}

function createAdminOrderedReviewCard(item, state) {
  const card = document.createElement("article");
  card.className = `ordered-review-card ${state || ""}`.trim();

  const body = document.createElement("div");

  const title = document.createElement("div");
  title.className = "ordered-review-title";
  title.textContent = item.item_name;
  body.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "ordered-review-meta";
  appendOrderedReviewMeta(meta, "Ordered", item.date_ordered);
  appendOrderedReviewMeta(meta, "Expected", item.expected_delivery_date);
  appendOrderedReviewMeta(meta, "QTY", item.package_qty);
  appendOrderedReviewMeta(meta, "Units/Package", item.units_per_package);
  appendOrderedReviewMeta(meta, "Company", item.item_company);
  appendOrderedReviewMeta(meta, "Supplier", item.item_supplier);
  appendOrderedReviewMeta(meta, "Department", item.department);
  appendOrderedReviewMeta(meta, "Requested By", item.requested_by);
  if (item.received_date) {
    appendOrderedReviewMeta(meta, "Received", item.received_date);
    appendOrderedReviewMeta(meta, "Time", item.received_time);
    appendOrderedReviewMeta(meta, "Location", item.received_location);
  }
  body.appendChild(meta);
  card.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "ordered-review-actions";
  card.appendChild(actions);

  return { card, actions };
}

function appendAdminDeleteOrderedItemButton(container, item) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Delete";
  button.addEventListener("click", () => deleteAdminOrderedItem(item.id));
  container.appendChild(button);
}

function appendMobileSummaryRow(table, labels, title, detailRow) {
  const summaryRow = document.createElement("tr");
  summaryRow.className = "mobile-summary-row";
  const summaryCell = document.createElement("td");
  summaryCell.colSpan = labels.length;
  summaryCell.dataset.label = "Item";
  summaryCell.textContent = title;
  summaryCell.tabIndex = 0;
  summaryCell.setAttribute("role", "button");
  summaryCell.setAttribute("aria-expanded", "false");

  const toggle = () => {
    const willFocus = !detailRow.classList.contains("mobile-focused");
    table.querySelectorAll("tr.mobile-focused").forEach(row => {
      if (row !== detailRow) row.classList.remove("mobile-focused");
    });
    table.querySelectorAll(".mobile-summary-row td[aria-expanded='true']").forEach(cell => {
      if (cell !== summaryCell) cell.setAttribute("aria-expanded", "false");
    });
    detailRow.classList.toggle("mobile-focused", willFocus);
    summaryCell.setAttribute("aria-expanded", String(willFocus));
  };

  summaryCell.addEventListener("click", toggle);
  summaryCell.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  });

  summaryRow.appendChild(summaryCell);
  table.appendChild(summaryRow);
}

async function deleteAdminOrderedItem(itemId) {
  if (!window.confirm("Delete this ordered item?")) return;

  const res = await adminFetch(`/ordered-items/${itemId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Could not delete ordered item: " + text, "error");
    return;
  }

  showMessage("Ordered item deleted.", "success");
  await loadOrderedAdminData();
  await loadAdminCalendar();
}

function renderExpectedDeliveriesTable() {
  const container = document.getElementById("adminExpectedDeliveries");
  const count = document.getElementById("adminExpectedDeliveriesCount");
  const mobileCount = document.getElementById("adminExpectedDeliveriesMobileCount");
  container.innerHTML = "";
  const expectedDeliveries = allOrderedItems.filter(item => !item.received_date && !Number(item.import_needs_delivery_date));
  if (count) {
    count.textContent = `${expectedDeliveries.length} expected`;
  }
  if (mobileCount) {
    mobileCount.textContent = `${expectedDeliveries.length} expected`;
  }

  if (!expectedDeliveries.length) {
    const empty = document.createElement("div");
    empty.className = "message";
    empty.textContent = "No expected deliveries.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "ordered-review-list";

  expectedDeliveries.forEach(item => {
    const { card, actions } = createAdminOrderedReviewCard(item, "");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const label = document.createElement("label");
    label.className = "receive-toggle";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        showAdminReceiveForm(item.id, actions, checkbox);
      }
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode("Received"));
    actions.appendChild(label);
    appendAdminDeleteOrderedItemButton(actions, item);

    list.appendChild(card);
  });

  container.appendChild(list);
}

function renderNeedsDeliveryDateTable() {
  const container = document.getElementById("adminNeedsDeliveryDateDeliveries");
  const count = document.getElementById("adminNeedsDeliveryDateCount");
  const mobileCount = document.getElementById("adminNeedsDeliveryDateMobileCount");
  if (!container) return;

  container.innerHTML = "";
  const deliveries = allOrderedItems.filter(item => !item.received_date && Number(item.import_needs_delivery_date));
  if (count) {
    count.textContent = `${deliveries.length} need date`;
  }
  if (mobileCount) {
    mobileCount.textContent = `${deliveries.length} need date`;
  }

  if (!deliveries.length) {
    const empty = document.createElement("div");
    empty.className = "message";
    empty.textContent = "No imported deliveries need a delivery date.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "ordered-review-list";

  deliveries.forEach(item => {
    const { card, actions } = createAdminOrderedReviewCard(item, "needs-date");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Set Date";
    button.addEventListener("click", () => {
      showAdminReceiveForm(item.id, actions, { checked: true });
    });
    actions.appendChild(button);
    appendAdminDeleteOrderedItemButton(actions, item);

    list.appendChild(card);
  });

  container.appendChild(list);
}

function showAdminReceiveForm(itemId, cell, checkbox) {
  const existingForm = cell.querySelector(".request-order-form");
  if (existingForm) {
    existingForm.classList.add("active");
    return;
  }

  const form = document.createElement("div");
  form.className = "request-order-form active";

  const receivedDate = document.createElement("input");
  receivedDate.type = "date";
  receivedDate.value = toIsoDate(new Date());
  form.appendChild(createOrderField("Received Date", receivedDate));

  const receivedTime = document.createElement("input");
  receivedTime.type = "text";
  receivedTime.placeholder = "00:00";
  receivedTime.inputMode = "numeric";
  receivedTime.maxLength = 5;
  receivedTime.pattern = "([01]\\d|2[0-3]):[0-5]\\d";
  receivedTime.title = "Received time as HH:MM";
  receivedTime.addEventListener("input", () => {
    receivedTime.value = receivedTime.value
      .replace(/[^\d:]/g, "")
      .replace(/^(\d{2})(\d)/, "$1:$2")
      .slice(0, 5);
  });
  form.appendChild(createOrderField("Time", receivedTime));

  const location = document.createElement("input");
  location.type = "text";
  form.appendChild(createOrderField("Location", location));

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save Received";
  saveButton.addEventListener("click", () => saveAdminReceivedItem(itemId, {
    received_date: receivedDate.value,
    received_time: receivedTime.value,
    received_location: location.value
  }));
  form.appendChild(saveButton);

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", () => {
    checkbox.checked = false;
    form.remove();
  });
  form.appendChild(cancelButton);

  cell.appendChild(form);
  location.focus();
}

async function saveAdminReceivedItem(itemId, payload) {
  const receivedTime = String(payload.received_time || "").trim();
  if (receivedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(receivedTime)) {
    showMessage("Received time must use HH:MM format.", "error");
    return;
  }

  payload.received_time = receivedTime;

  const res = await fetch(`/ordered-items/${itemId}/receive`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Could not mark delivery received: " + text, "error");
    return;
  }

  showMessage("Delivery marked received.", "success");
  await loadOrderedItems();
}

function renderReceivedDeliveriesTable() {
  const container = document.getElementById("adminReceivedDeliveries");
  const count = document.getElementById("adminReceivedDeliveriesCount");
  const mobileCount = document.getElementById("adminReceivedDeliveriesMobileCount");
  container.innerHTML = "";
  const receivedDeliveries = allOrderedItems.filter(item => item.received_date);
  if (count) {
    count.textContent = `${receivedDeliveries.length} received`;
  }
  if (mobileCount) {
    mobileCount.textContent = `${receivedDeliveries.length} received`;
  }

  if (!receivedDeliveries.length) {
    const empty = document.createElement("div");
    empty.className = "message";
    empty.textContent = "No received deliveries yet.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "ordered-review-list";

  receivedDeliveries.forEach(item => {
    const { card, actions } = createAdminOrderedReviewCard(item, "received");
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.textContent = "Undo";
    undoButton.addEventListener("click", () => undoAdminReceivedItem(item.id));
    actions.appendChild(undoButton);
    appendAdminDeleteOrderedItemButton(actions, item);

    list.appendChild(card);
  });

  container.appendChild(list);
}

async function undoAdminReceivedItem(itemId) {
  const res = await fetch(`/ordered-items/${itemId}/undo-receive`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" }
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Could not undo received delivery: " + text, "error");
    return;
  }

  showMessage("Delivery moved back to expected deliveries.", "success");
  await loadOrderedItems();
}

async function saveOrderedItem() {
  const items = getOrderedItemRows();
  const payload = {
    date_ordered: document.getElementById("ordered_date_ordered").value,
    expected_delivery_date: document.getElementById("ordered_expected_delivery_date").value,
    items,
    item_supplier: document.getElementById("ordered_item_supplier").value,
    department: document.getElementById("ordered_department").value
  };

  const res = await adminFetch("/admin/ordered-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Ordered delivery save failed: " + text, "error");
    return;
  }

  resetOrderedForm();
  showMessage("Ordered delivery added.", "success");
  await loadOrderedItems();
}

async function importOrderedPdf() {
  const fileInput = document.getElementById("ordered_import_pdf");
  const departmentInput = document.getElementById("ordered_import_department");
  const result = document.getElementById("orderedImportResult");
  const file = fileInput.files[0];
  const department = departmentInput.value.trim();

  result.textContent = "";

  if (!file) {
    showMessage("Choose an order details PDF to import.", "error");
    return;
  }

  if (!department) {
    showMessage("Department is required for imported order items.", "error");
    departmentInput.focus();
    return;
  }

  const res = await adminFetch(`/admin/ordered-items/import-pdf?department=${encodeURIComponent(department)}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: file
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("PDF import failed: " + text, "error");
    return;
  }

  const imported = await res.json();
  fileInput.value = "";
  showMessage(`Imported ${imported.items.length} order item${imported.items.length === 1 ? "" : "s"}.`, "success");
  result.textContent = imported.items
    .map(item => {
      const status = item.received_date
        ? `delivered ${item.received_date}`
        : item.import_needs_delivery_date
          ? "needs delivery date"
          : `expected ${item.expected_delivery_date}`;
      return `${status}: ${item.item_name} - QTY ${item.package_qty}`;
    })
    .join("\n");

  await loadOrderedItems();
  await loadAdminCalendar();
}

async function importProductionNeedsPdf() {
  const fileInput = document.getElementById("productionNeedsPdf");
  const file = fileInput && fileInput.files && fileInput.files[0];

  if (!file) {
    showMessage("Choose a production needs PDF to review.", "error");
    return;
  }

  const res = await adminFetch("/admin/production-needs/import-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-Production-Needs-File-Name": file.name
    },
    body: file
  });

  if (!res.ok) {
    const text = await res.text();
    showMessage("Production needs import failed: " + text, "error");
    return;
  }

  const parsed = await res.json();
  renderProductionNeeds(parsed.items || [], getProductionNeedsMetaText(parsed));
  fileInput.value = "";
  showMessage("Production needs report loaded.", "success");
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (!document.getElementById("dailyReportFocus").hidden) {
      closeDailyReportFocus();
    }
    if (!document.getElementById("itemTaskEditPanel").hidden) {
      cancelItemTaskEdit();
    }
    if (!document.getElementById("adminCalendarDayFocus").hidden) {
      closeAdminCalendarDayFocus();
    }
    closeAdminManualReceivedWindow();
  }
});

document.getElementById("dailyReportFocus").addEventListener("click", event => {
  if (event.target.id === "dailyReportFocus") {
    closeDailyReportFocus();
  }
});

document.getElementById("adminCalendarDayFocus").addEventListener("click", event => {
  if (event.target.id === "adminCalendarDayFocus") {
    closeAdminCalendarDayFocus();
  }
});

window.addEventListener("afterprint", () => {
  document.body.classList.remove("printing-item-task-report");
  document.body.classList.remove("printing-concern-report");
});

async function initAdmin() {
  loadEmployeeSelects();
  await loadLookups();
  setDefaultCalendarRange();
  resetOrderedForm();
  resetAdminOrderRequestForm();
  resetAdminManualReceivedForm();
  setupAdminTimeInput("admin_manual_received_time");
  await loadProductionNeedsReport();
  await loadReport();
}

function registerProductionTrackerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Register the PWA shell worker. It only handles static files/icons, so live
  // Render/Turso API calls continue through the normal network request flow.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch(err => console.warn("PWA service worker registration failed:", err));
  });
}

registerProductionTrackerServiceWorker();
initAdmin();
