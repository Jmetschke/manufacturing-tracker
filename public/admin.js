let reportData = [];
let allEntries = [];
let allItems = [];
let allTasks = [];
let itemTaskOptionsByItemId = {};
let allOrderedItems = [];
let allOrderRequests = [];
let adminScheduleRows = new Map();
let adminExpectedDeliveriesByDate = new Map();
let adminEventsByDate = new Map();
let adminProjectedTasksByDate = new Map();
let adminProjectedProcessingTasksByDate = new Map();
let adminCalendarStartDate = null;
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
const productionBatchOptions = [...hijnxBatchOptions, ...sbBatchOptions];

function showMessage(text, type = "") {
  const message = document.getElementById("message");
  message.textContent = text;
  message.className = type ? `message ${type}` : "message";
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
    document.getElementById("edit_task"),
    allTasks.map(task => ({ value: task.id, text: task.name }))
  );

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

function normalizeBatchList(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item && typeof item === "object") {
          return {
            item: String(item.item || "").trim(),
            units: String(item.units || "").trim()
          };
        }

        return {
          item: String(item || "").trim(),
          units: ""
        };
      })
      .filter(batch => batch.item);
  }

  const singleValue = String(value || "").trim();
  return singleValue ? [{ item: singleValue, units: "" }] : [];
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
  const days = Math.max(1, Number.parseInt(task && task.days, 10) || 1);
  const totalHours = Math.max(0, Number.parseFloat(task && task.totalHours) || 0);

  return {
    text,
    item,
    days,
    totalHours,
    assignments: normalizeScheduleAssignments(task && task.assignments, days)
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
      ? `${label}: ${batch.item} - ${batch.units} units`
      : `${label}: ${batch.item}`;
    batchList.appendChild(item);
  });

  container.appendChild(batchList);
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

  rows.forEach(row => {
    const [year, month, day] = row.schedule_date.split("-").map(Number);
    const startDate = new Date(year, month - 1, day);
    const payload = parseSchedulePayload(row.tasks);

    taskSelector(payload).forEach(task => {
      let remainingHours = task.totalHours;
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
              item: task.item,
              text: task.text,
              employee: assignment.employee,
              hours: appliedHours,
              remainingHours,
              totalHours: task.totalHours
            });
          });
        } else if (task.totalHours > 0) {
          projectedTasks.push({
            item: task.item,
            text: task.text,
            remainingHours,
            totalHours: task.totalHours
          });
        } else {
          projectedTasks.push({ item: task.item, text: task.text, days: task.days });
        }

        if (activeDate < rangeStart || activeDate > rangeEnd) return;

        const isoDate = toIsoDate(activeDate);
        if (!tasksByDate.has(isoDate)) {
          tasksByDate.set(isoDate, []);
        }
        tasksByDate.get(isoDate).push(...projectedTasks);
      });
    });
  });

  return tasksByDate;
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

  const list = document.createElement("div");
  list.className = className;

  groupDailyTaskAssignments(processingTasks).forEach(task => {
    const item = document.createElement("div");
    item.className = "calendar-processing-task";
    item.textContent = task.assignedHours > 0
      ? `${getTaskDisplayText(task)} - ${formatTaskHours(task.assignedHours)}`
      : task.legacyDays > 1
        ? `${getTaskDisplayText(task)} - ${task.legacyDays} days`
        : getTaskDisplayText(task);
    list.appendChild(item);
  });

  container.appendChild(list);
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

  const order = document.createElement("span");
  order.className = "batch-order";
  row.appendChild(order);

  const input = document.createElement("select");
  input.className = "batch-input";

  const options = type === "hijnx" ? hijnxBatchOptions : sbBatchOptions;
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
  row.appendChild(input);

  const units = document.createElement("input");
  units.type = "number";
  units.className = "batch-units";
  units.min = "0";
  units.step = "1";
  units.placeholder = "Units";
  units.value = batchUnits;
  row.appendChild(units);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
    if (!rows.children.length) {
      addBatchEntry(type);
      return;
    }
    refreshBatchRows(type);
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
      units: row.querySelector(".batch-units").value.trim()
    }))
    .filter(batch => batch.item);
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
    const key = `${task.item || ""}\n${task.text}`;
    if (!groups.has(key)) {
      groups.set(key, {
        item: task.item || "",
        text: task.text,
        assignedHours: 0,
        remainingHours: task.remainingHours,
        people: new Map(),
        legacyDays: task.days || 1
      });
    }

    const group = groups.get(key);
    if (task.hours) {
      group.assignedHours += task.hours;
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

function appendCalendarTaskSummary(container, tasks, className) {
  const lines = Array.isArray(tasks) ? tasks : getScheduleTasks(tasks);
  if (!lines.length) return;

  const list = document.createElement("ol");
  list.className = className;

  groupDailyTaskAssignments(lines).forEach(task => {
    const item = document.createElement("li");
    item.textContent = task.assignedHours > 0
      ? `${getTaskDisplayText(task)} - ${formatTaskHours(task.assignedHours)}`
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

  const section = (headingText, fill) => {
    const block = document.createElement("div");
    block.className = "calendar-focus-section";
    const heading = document.createElement("h4");
    heading.textContent = headingText;
    block.appendChild(heading);
    fill(block);
    body.appendChild(block);
  };

  section("Tasks", block => {
    const groups = groupDailyTaskAssignments(projectedTasks);
    if (!groups.length) {
      block.appendChild(createFocusEmpty("No tasks scheduled."));
      return;
    }

    groups.forEach(task => {
      const item = document.createElement("div");
      item.className = "calendar-focus-item";
      const titleLine = document.createElement("b");
      titleLine.textContent = `${getTaskDisplayText(task)} - ${formatTaskHours(task.assignedHours)} assigned`;
      item.appendChild(titleLine);

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
      } else {
        item.appendChild(createFocusEmpty("No person hours assigned for this day."));
      }

      if (Number.isFinite(task.remainingHours)) {
        const remaining = document.createElement("div");
        remaining.textContent = `${formatTaskHours(task.remainingHours)} remaining after this day`;
        item.appendChild(remaining);
      }

      block.appendChild(item);
    });
  });

  section("Events", block => appendFocusLines(block, events, event => {
    const timeText = event.start && event.end ? ` ${event.start}-${event.end}` : "";
    return `${event.title}${timeText} - ${event.location} - ${event.company}`;
  }, "No events scheduled."));

  section("Production Batches", block => appendFocusLines(block, [
    ...payload.batchHijnx.map(batch => ({ label: "Hijnx", ...batch })),
    ...payload.batchSb.map(batch => ({ label: "SB", ...batch }))
  ], batch => batch.units ? `${batch.label}: ${batch.item} - ${batch.units} units` : `${batch.label}: ${batch.item}`, "No production batches."));

  section("Deliveries", block => appendFocusLines(block, deliveries, delivery =>
    `${delivery.calendar_delivery_status}: ${delivery.item_name} - QTY ${delivery.package_qty || ""}`.trim(),
  "No deliveries."));

  section("Test Pick Ups", block => appendFocusLines(block, payload.testPickups, pickup =>
    `Test Pick Up ${pickup.time}: ${pickup.items.join(", ")}`,
  "No test pick ups."));

  section("Processing Tasks", block => appendTaskFocusDetails(block, projectedProcessingTasks, "No processing tasks."));

  panel.hidden = false;
  panel.scrollIntoView({ block: "start", behavior: "smooth" });
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
    const titleLine = document.createElement("b");
    titleLine.textContent = `${getTaskDisplayText(task)} - ${formatTaskHours(task.assignedHours)} assigned`;
    item.appendChild(titleLine);

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
    } else {
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
  document.getElementById("calendarPanel").classList.toggle("active", tabName === "calendar");
  document.getElementById("orderedPanel").classList.toggle("active", tabName === "ordered");

  document.querySelectorAll(".admin-tab-button").forEach(button => {
    const isActive =
      (tabName === "entries" && button.textContent === "Entries") ||
      (tabName === "calendar" && button.textContent === "Calendar") ||
      (tabName === "ordered" && button.textContent === "Ordered Items");
    button.classList.toggle("active", isActive);
  });

  showMessage("");

  if (tabName === "calendar") {
    loadAdminCalendar();
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

  renderTable();
  renderSummary();
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
        quantity: 0,
        seconds: 0
      });
    }

    const group = groups.get(mapKey);
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

function renderTable() {
  const container = document.getElementById("table");
  container.innerHTML = "";

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

  reportData.forEach(entry => {
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
    row.appendChild(actionCell);

    table.appendChild(row);
  });

  container.appendChild(table);
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
  const from = toIsoDate(addDays(gridStart, -180));
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
  adminEventsByDate = buildAdminEventsByDate(rows, gridStart, gridEnd);
  adminProjectedTasksByDate = buildAdminProjectedTasksByDate(rows, gridStart, gridEnd);
  adminProjectedProcessingTasksByDate = buildAdminProjectedTasksByDate(rows, gridStart, gridEnd, payload => payload.processingTasks);
  updateCalendarRangeLabel(gridStart, gridEnd);
  renderAdminCalendar(gridStart);
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
    cell.tabIndex = 0;
    cell.setAttribute("role", "button");
    cell.setAttribute("aria-label", `View details for ${formatDisplayDate(isoDate)}`);

    const dateLabel = document.createElement("div");
    dateLabel.className = "admin-calendar-date";
    dateLabel.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
    cell.appendChild(dateLabel);

    const activeEvents = adminEventsByDate.get(isoDate) || [];
    const activeDeliveries = adminExpectedDeliveriesByDate.get(isoDate) || [];
    const activeTasks = adminProjectedTasksByDate.get(isoDate) || [];
    const activeProcessingTasks = adminProjectedProcessingTasksByDate.get(isoDate) || [];

    appendEventList(cell, activeEvents);

    const payload = parseSchedulePayload(adminScheduleRows.get(isoDate));
    appendBatchList(cell, payload);
    appendAdminExpectedDeliveries(cell, activeDeliveries);
    appendTestPickupList(cell, payload);

    const tasks = document.createElement("div");
    tasks.className = "admin-calendar-tasks";
    appendCalendarTaskSummary(tasks, activeTasks, "admin-task-list");
    cell.appendChild(tasks);
    appendProcessingTaskList(cell, activeProcessingTasks);
    cell.addEventListener("click", () => {
      renderAdminFocusedDay(isoDate, payload, activeTasks, activeProcessingTasks, activeDeliveries, activeEvents);
    });
    cell.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        renderAdminFocusedDay(isoDate, payload, activeTasks, activeProcessingTasks, activeDeliveries, activeEvents);
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
  hours.addEventListener("input", () => updateScheduleTaskRemaining(taskRow));
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

function addScheduleTask(value = "", daysValue = 1, rowsId = "scheduleTaskRows") {
  const rows = document.getElementById(rowsId);
  const row = document.createElement("div");
  row.className = "schedule-task-row";
  row.dataset.rowsId = rowsId;
  const task = value && typeof value === "object" ? value : { text: value, days: daysValue };

  const order = document.createElement("span");
  order.className = "schedule-task-order";
  row.appendChild(order);

  const itemSelect = createScheduleItemSelect(task.item || "");
  row.appendChild(itemSelect);

  const input = document.createElement("select");
  input.className = "schedule-task-input";
  renderScheduleTaskSelect(input, itemSelect.value, task.text || "");
  itemSelect.addEventListener("change", () => {
    renderScheduleTaskSelect(input, itemSelect.value);
  });
  row.appendChild(input);

  const totalHours = document.createElement("input");
  totalHours.type = "number";
  totalHours.className = "schedule-task-hours";
  totalHours.min = "0";
  totalHours.step = "0.25";
  totalHours.value = task.totalHours || "";
  totalHours.placeholder = "Total hours";
  totalHours.title = "Total hours";
  totalHours.addEventListener("input", () => updateScheduleTaskRemaining(row));
  row.appendChild(totalHours);

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
  row.appendChild(days);

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
  row.appendChild(upButton);

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
  row.appendChild(downButton);

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
  row.appendChild(removeButton);

  const assignmentPanel = document.createElement("div");
  assignmentPanel.className = "schedule-assignment-panel";

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

  productionBatchOptions.forEach(itemName => {
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
        totalHours: Math.max(0, Number.parseFloat(row.querySelector(".schedule-task-hours").value) || 0),
        days,
        assignments: Array.from(row.querySelectorAll(".schedule-assignment-row"))
          .map(assignmentRow => ({
            dayIndex: Math.max(0, Number.parseInt(assignmentRow.querySelector(".schedule-assignment-day").value, 10) || 0),
            employee: assignmentRow.querySelector(".schedule-assignment-employee").value.trim(),
            hours: Math.max(0, Number.parseFloat(assignmentRow.querySelector(".schedule-assignment-hours").value) || 0)
          }))
          .filter(assignment => assignment.dayIndex < days && assignment.employee && assignment.hours > 0)
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
    task.totalHours <= 0 ||
    task.assignments.reduce((sum, assignment) => sum + assignment.hours, 0) > task.totalHours
  );
  if (invalidTask) {
    throw new Error("Each task needs total hours, and assigned person hours cannot exceed the task total.");
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
  const taskSection = document.querySelector(".schedule-task-section");

  document.getElementById("schedule_edit_date").value = isoDate;
  document.getElementById("scheduleEditLabel").textContent = formatDisplayDate(isoDate);
  populateEventRows(payload.events);
  populateBatchRows("hijnx", payload.batchHijnx);
  populateBatchRows("sb", payload.batchSb);
  taskSection.hidden = isWeekendDay;
  populateScheduleTaskRows(isWeekendDay ? "" : adminScheduleRows.get(isoDate) || "");
  populateTestPickupRows(isWeekendDay ? [] : payload.testPickups);
  populateScheduleTaskRows(isWeekendDay ? [] : payload.processingTasks, "processingTaskRows", false);
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
  document.querySelector(".schedule-task-section").hidden = false;
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

function appendDeliveryRowCells(row, item, labels, includeReceivedDetails = false) {
  const values = [
    item.date_ordered,
    item.expected_delivery_date,
    item.item_name,
    item.item_company,
    item.package_qty,
    item.units_per_package || "",
    item.item_supplier,
    item.department,
    item.requested_by || ""
  ];

  values.forEach((value, index) => appendCell(row, value, labels[index]));

  if (includeReceivedDetails) {
    appendCell(row, item.received_date || "", labels[values.length]);
    appendCell(row, item.received_time || "", labels[values.length + 1]);
    appendCell(row, item.received_location || "", labels[values.length + 2]);
  }
}

function appendDeliveryHeader(table, extraLabels = []) {
  const headerRow = document.createElement("tr");
  headerRow.className = "table-heading-row";
  const labels = [
    "Date Ordered",
    "Expected Delivery",
    "Item Name",
    "Item Company",
    "Package QTY",
    "Units/Package",
    "Supplier",
    "Department",
    "Requested By",
    ...extraLabels
  ];

  labels.forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);
  return labels;
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

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const labels = appendDeliveryHeader(table, ["Received"]);

  expectedDeliveries.forEach(item => {
    const row = document.createElement("tr");
    appendDeliveryRowCells(row, item, labels);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[labels.length - 1];
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        showAdminReceiveForm(item.id, actionCell, checkbox);
      }
    });
    actionCell.appendChild(checkbox);
    row.appendChild(actionCell);

    appendMobileSummaryRow(table, labels, item.item_name, row);
    table.appendChild(row);
  });

  container.appendChild(table);
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

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const labels = appendDeliveryHeader(table, ["Delivery Date"]);

  deliveries.forEach(item => {
    const row = document.createElement("tr");
    appendDeliveryRowCells(row, item, labels);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[labels.length - 1];
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Set Date";
    button.addEventListener("click", () => {
      showAdminReceiveForm(item.id, actionCell, { checked: true });
    });
    actionCell.appendChild(button);
    row.appendChild(actionCell);

    appendMobileSummaryRow(table, labels, item.item_name, row);
    table.appendChild(row);
  });

  container.appendChild(table);
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

  const table = document.createElement("table");
  table.className = "mobile-stack";
  const labels = appendDeliveryHeader(table, ["Received Date", "Time", "Location", "Action"]);

  receivedDeliveries.forEach(item => {
    const row = document.createElement("tr");
    appendDeliveryRowCells(row, item, labels, true);

    const actionCell = document.createElement("td");
    actionCell.dataset.label = labels[labels.length - 1];
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.textContent = "Undo";
    undoButton.addEventListener("click", () => undoAdminReceivedItem(item.id));
    actionCell.appendChild(undoButton);
    row.appendChild(actionCell);

    appendMobileSummaryRow(table, labels, item.item_name, row);
    table.appendChild(row);
  });

  container.appendChild(table);
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

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeAdminManualReceivedWindow();
  }
});

async function initAdmin() {
  loadEmployeeSelects();
  await loadLookups();
  setDefaultCalendarRange();
  resetOrderedForm();
  resetAdminOrderRequestForm();
  resetAdminManualReceivedForm();
  setupAdminTimeInput("admin_manual_received_time");
  await loadReport();
}

initAdmin();
