"use strict";

/* =========================
   Supabase
========================= */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


/* =========================
   データ
========================= */

let appData = {
  staff: [],
  shiftTypes: [],
  leaveTypes: [],
  companyHolidays: [],
  shifts: {},
  leaves: {},
  akeTime: {
    start: "05:30",
    end: "11:15"
  }
};

let currentDate = new Date();
currentDate.setDate(1);

let editingStaffIndex = -1;
let editingShiftIndex = -1;
let editingHolidayId = null;
let editingLeaveTypeId = null;

let selectedCell = null;
let selectedCalendarStaff = null;

let publicHolidays = {};

let realtimeChannel = null;
let realtimeReloadTimer = null;
let autoSyncTimer = null;

let cloudOperationBusy = false;


/* =========================
   起動
========================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    loadLocalData();

    setupEvents();

    renderAll();

    setStatus("読み込み中...");

    await loadPublicHolidays();

    await loadAllFromSupabase();

    setupRealtime();

    startAutoSync();

  }
);


/* =========================
   ステータス
========================= */

function setStatus(text) {

  const el =
    document.getElementById("appStatus");

  if (el) {
    el.textContent = text;
  }

}


/* =========================
   ローカル保存
========================= */

function saveLocalData() {

  try {

    localStorage.setItem(
      "workScheduleAppData",
      JSON.stringify(appData)
    );

  } catch (error) {

    console.error(
      "localStorage保存エラー",
      error
    );

  }

}


function loadLocalData() {

  try {

    const saved =
      localStorage.getItem(
        "workScheduleAppData"
      );

    if (!saved) {
      return;
    }

    const data =
      JSON.parse(saved);

    appData = {
      staff:
        Array.isArray(data.staff)
          ? data.staff
          : [],

      shiftTypes:
        Array.isArray(data.shiftTypes)
          ? data.shiftTypes
          : [],

      leaveTypes:
        Array.isArray(data.leaveTypes)
          ? data.leaveTypes
          : [],

      companyHolidays:
        Array.isArray(data.companyHolidays)
          ? data.companyHolidays
          : [],

      shifts:
        data.shifts || {},

      leaves:
        data.leaves || {},

      akeTime:
        data.akeTime || {
          start: "05:30",
          end: "11:15"
        }
    };

  } catch (error) {

    console.error(
      "localStorage読み込みエラー",
      error
    );

  }

}


/* =========================
   Supabase 全読み込み
========================= */

async function loadAllFromSupabase() {

  try {

    const results =
      await Promise.allSettled([

        supabaseClient
          .from("staff")
          .select(
            "id,name,created_at,sort_order,calendar_token"
          )
          .order(
            "sort_order",
            {
              ascending: true,
              nullsFirst: false
            }
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("shift_types")
          .select(
            "id,name,created_at,start_time,end_time,break_time"
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("work_shifts")
          .select(
            "id,staff_name,work_date,shift_name,leave_type"
          ),

        supabaseClient
          .from("company_holidays")
          .select(
            "id,name,start_date,end_date,created_at"
          )
          .order(
            "start_date",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("leave_types")
          .select(
            "id,name,color,created_at"
          )
          .order(
            "created_at",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("app_settings")
          .select(
            "setting_name,setting_value"
          )

      ]);


    const staffResult =
      results[0];

    const shiftResult =
      results[1];

    const workResult =
      results[2];

    const holidayResult =
      results[3];

    const leaveResult =
      results[4];

    const settingResult =
      results[5];


    /* 職員 */

    if (
      staffResult.status === "fulfilled" &&
      !staffResult.value.error
    ) {

      appData.staff =
        (staffResult.value.data || [])
          .filter(
            x => x.name !== "明"
          )
          .map(
            x => ({
              id: x.id,
              name: x.name,
              created_at: x.created_at,
              sort_order: x.sort_order,
              calendar_token:
                x.calendar_token
            })
          );

    } else {

      console.error(
        "staff読み込みエラー",
        staffResult
      );

    }


    /* 勤務形態 */

    if (
      shiftResult.status === "fulfilled" &&
      !shiftResult.value.error
    ) {

      appData.shiftTypes =
        shiftResult.value.data || [];

    } else {

      console.error(
        "shift_types読み込みエラー",
        shiftResult
      );

    }


    /* 勤務 */

    if (
      workResult.status === "fulfilled" &&
      !workResult.value.error
    ) {

      appData.shifts = {};
      appData.leaves = {};

      (
        workResult.value.data || []
      ).forEach(
        row => {

          if (
            !row.staff_name ||
            !row.work_date
          ) {
            return;
          }

          if (
            row.leave_type
          ) {

            if (
              !appData.leaves[
                row.staff_name
              ]
            ) {
              appData.leaves[
                row.staff_name
              ] = {};
            }

            appData.leaves[
              row.staff_name
            ][
              row.work_date
            ] = row.leave_type;

          } else {

            if (
              !appData.shifts[
                row.staff_name
              ]
            ) {
              appData.shifts[
                row.staff_name
              ] = {};
            }

            appData.shifts[
              row.staff_name
            ][
              row.work_date
            ] = row.shift_name || "";

          }

        }
      );

    } else {

      console.error(
        "work_shifts読み込みエラー",
        workResult
      );

    }


    /* 休業日 */

    if (
      holidayResult.status === "fulfilled" &&
      !holidayResult.value.error
    ) {

      appData.companyHolidays =
        holidayResult.value.data || [];

    } else {

      console.error(
        "company_holidays読み込みエラー",
        holidayResult
      );

    }


    /* 休暇種類 */

    if (
      leaveResult.status === "fulfilled" &&
      !leaveResult.value.error
    ) {

      appData.leaveTypes =
        leaveResult.value.data || [];

    } else {

      console.error(
        "leave_types読み込みエラー",
        leaveResult
      );

    }


    /* 設定 */

    if (
      settingResult.status === "fulfilled" &&
      !settingResult.value.error
    ) {

      (
        settingResult.value.data || []
      ).forEach(
        row => {

          if (
            row.setting_name ===
            "ake_start"
          ) {
            appData.akeTime.start =
              row.setting_value ||
              "05:30";
          }

          if (
            row.setting_name ===
            "ake_end"
          ) {
            appData.akeTime.end =
              row.setting_value ||
              "11:15";
          }

        }
      );

    } else {

      console.error(
        "app_settings読み込みエラー",
        settingResult
      );

    }


    saveLocalData();

    renderAll();

    setStatus("同期済み");

  } catch (error) {

    console.error(
      "Supabase読み込みエラー",
      error
    );

    renderAll();

    setStatus("ローカルデータを表示中");

  }

}


/* =========================
   イベント
========================= */

function setupEvents() {

  document
    .querySelectorAll(".nav-button")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            showPage(
              button.dataset.page
            );

          }
        );

      }
    );


  const prev =
    document.getElementById(
      "prevMonth"
    );

  if (prev) {

    prev.addEventListener(
      "click",
      () => {

        currentDate.setMonth(
          currentDate.getMonth() - 1
        );

        renderSchedule();

      }
    );

  }


  const next =
    document.getElementById(
      "nextMonth"
    );

  if (next) {

    next.addEventListener(
      "click",
      () => {

        currentDate.setMonth(
          currentDate.getMonth() + 1
        );

        renderSchedule();

      }
    );

  }


  bindButton(
    "addStaffButton",
    addStaff
  );

  bindButton(
    "addShiftButton",
    addShiftType
  );

  bindButton(
    "addCompanyHolidayButton",
    addCompanyHoliday
  );

  bindButton(
    "addLeaveTypeButton",
    addLeaveType
  );

  bindButton(
    "saveAkeTimeButton",
    saveAkeTime
  );

  bindButton(
    "deleteMonthButton",
    deleteCurrentMonth
  );

  bindButton(
    "deleteFiscalYearButton",
    deleteFiscalYear
  );


  bindButton(
    "calendarCancelButton",
    closeCalendarConfirm
  );

  bindButton(
    "calendarOKButton",
    exportCalendar
  );


  document.addEventListener(
    "click",
    event => {

      const shiftMenu =
        document.getElementById(
          "shiftMenu"
        );

      const leaveMenu =
        document.getElementById(
          "leaveMenu"
        );

      if (
        shiftMenu &&
        shiftMenu.style.display !== "none" &&
        !shiftMenu.contains(
          event.target
        ) &&
        !event.target.closest(
          ".schedule-cell"
        )
      ) {

        closeShiftMenu();

      }

      if (
        leaveMenu &&
        leaveMenu.style.display !== "none" &&
        !leaveMenu.contains(
          event.target
        ) &&
        !event.target.closest(
          ".schedule-cell"
        )
      ) {

        closeLeaveMenu();

      }

    }
  );


  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.visibilityState ===
        "visible"
      ) {

        loadAllFromSupabase();

      }

    }
  );

}


function bindButton(
  id,
  fn
) {

  const el =
    document.getElementById(id);

  if (el) {

    el.addEventListener(
      "click",
      fn
    );

  }

}


/* =========================
   ページ切り替え
========================= */

function showPage(page) {

  const pages = {
    schedule:
      "schedulePage",

    staff:
      "staffPage",

    shift:
      "shiftPage",

    holiday:
      "holidayPage",

    leaveType:
      "leaveTypePage"
  };


  Object.values(pages)
    .forEach(
      id => {

        const el =
          document.getElementById(id);

        if (el) {

          el.style.display =
            "none";

        }

      }
    );


  const target =
    document.getElementById(
      pages[page]
    );

  if (target) {

    target.style.display =
      "block";

  }


  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
            page
        );

      }
    );

}


/* =========================
   全描画
========================= */

function renderAll() {

  renderSchedule();

  renderStaffList();

  renderShiftList();

  renderCompanyHolidayList();

  renderLeaveTypeList();

  renderAkeTime();

}


/* =========================
   勤務表
========================= */

function renderSchedule() {

  const header =
    document.getElementById(
      "scheduleHeader"
    );

  const body =
    document.getElementById(
      "scheduleBody"
    );

  const monthText =
    document.getElementById(
      "currentMonth"
    );


  if (
    !header ||
    !body
  ) {
    return;
  }


  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  if (monthText) {

    monthText.textContent =
      `${year}年${month + 1}月`;

  }


  header.innerHTML = "";

  body.innerHTML = "";


  const staffHeader =
    document.createElement("th");

  staffHeader.textContent =
    "職員";

  staffHeader.className =
    "staff-column";

  header.appendChild(
    staffHeader
  );


  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const th =
      document.createElement("th");

    const date =
      new Date(
        year,
        month,
        day
      );

    const dateKey =
      formatDate(date);

    const week =
      [
        "日",
        "月",
        "火",
        "水",
        "木",
        "金",
        "土"
      ][
        date.getDay()
      ];


    th.innerHTML =
      `${day}<small>${week}</small>`;

    th.className =
      "date-header";


    if (
      date.getDay() === 0
    ) {

      th.classList.add(
        "sunday"
      );

    }

    if (
      date.getDay() === 6
    ) {

      th.classList.add(
        "saturday"
      );

    }

    if (
      isHoliday(dateKey)
    ) {

      th.classList.add(
        "holiday"
      );

    }


    header.appendChild(th);

  }


  const totalHeader =
    document.createElement("th");

  totalHeader.textContent =
    "計";

  totalHeader.className =
    "total-column";

  header.appendChild(
    totalHeader
  );


  appData.staff.forEach(
    (staff, staffIndex) => {

      const tr =
        document.createElement("tr");


      const nameCell =
        document.createElement("td");

      nameCell.className =
        "staff-column staff-name-cell";

      const nameButton =
        document.createElement("button");

      nameButton.type =
        "button";

      nameButton.className =
        "staff-name-button";

      nameButton.textContent =
        staff.name;

      nameButton.addEventListener(
        "click",
        () => {

          openCalendarConfirm(
            staff.name
          );

        }
      );

      nameCell.appendChild(
        nameButton
      );

      tr.appendChild(
        nameCell
      );


      let count = 0;


      for (
        let day = 1;
        day <= days;
        day++
      ) {

        const date =
          new Date(
            year,
            month,
            day
          );

        const dateKey =
          formatDate(date);


        const td =
          document.createElement("td");

        td.className =
          "schedule-cell";


        if (
          date.getDay() === 0
        ) {

          td.classList.add(
            "sunday"
          );

        }

        if (
          date.getDay() === 6
        ) {

          td.classList.add(
            "saturday"
          );

        }

        if (
          isHoliday(dateKey)
        ) {

          td.classList.add(
            "holiday"
          );

        }


        const leave =
          getLeave(
            staff.name,
            dateKey
          );

        const shift =
          getShift(
            staff.name,
            dateKey
          );


        let displayText = "";

        if (leave) {

          displayText =
            leave;

          const leaveType =
            appData.leaveTypes.find(
              x =>
                x.name === leave
            );

          if (
            leaveType &&
            leaveType.color
          ) {

            td.style.backgroundColor =
              leaveType.color;

          }

          count++;

        } else if (shift) {

          displayText =
            shift;

          count++;

        } else if (
          shouldShowAke(
            staff.name,
            dateKey
          )
        ) {

          displayText =
            "明";

        }


        td.textContent =
          displayText;


        td.addEventListener(
          "click",
          () => {

            openCellMenu(
              td,
              staff.name,
              dateKey
            );

          }
        );


        tr.appendChild(td);

      }


      const totalCell =
        document.createElement("td");

      totalCell.className =
        "total-column";

      totalCell.textContent =
        count;

      tr.appendChild(
        totalCell
      );


      body.appendChild(tr);

    }
  );

}


/* =========================
   日付
========================= */

function formatDate(date) {

  const y =
    date.getFullYear();

  const m =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const d =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${y}-${m}-${d}`;

}


/* =========================
   祝日
========================= */

async function loadPublicHolidays() {

  try {

    const response =
      await fetch(
        "https://holidays-jp.github.io/api/v1/date.json"
      );

    if (
      !response.ok
    ) {
      return;
    }

    publicHolidays =
      await response.json();

  } catch (error) {

    console.error(
      "祝日取得エラー",
      error
    );

  }

}


function isHoliday(dateKey) {

  if (
    publicHolidays[dateKey]
  ) {
    return true;
  }


  return appData.companyHolidays
    .some(
      holiday => {

        return (
          dateKey >=
            holiday.start_date &&
          dateKey <=
            holiday.end_date
        );

      }
    );

}


/* =========================
   勤務・休暇取得
========================= */

function getShift(
  staffName,
  dateKey
) {

  return (
    appData.shifts?.[
      staffName
    ]?.[
      dateKey
    ] || ""
  );

}


function getLeave(
  staffName,
  dateKey
) {

  return (
    appData.leaves?.[
      staffName
    ]?.[
      dateKey
    ] || ""
  );

}


/* =========================
   「明」
========================= */

function shouldShowAke(
  staffName,
  dateKey
) {

  const current =
    new Date(
      dateKey + "T00:00:00"
    );

  const previous =
    new Date(current);

  previous.setDate(
    previous.getDate() - 1
  );


  const previousKey =
    formatDate(previous);


  if (
    getLeave(
      staffName,
      dateKey
    )
  ) {
    return false;
  }


  if (
    getShift(
      staffName,
      dateKey
    )
  ) {
    return false;
  }


  const previousShift =
    getShift(
      staffName,
      previousKey
    );


  if (!previousShift) {
    return false;
  }


  return isNightShiftName(
    previousShift
  );

}


function isNightShiftName(
  name
) {

  if (!name) {
    return false;
  }

  return (
    name.includes("宿") ||
    name.includes("夜")
  );

}


/* =========================
   勤務セルメニュー
========================= */

function openCellMenu(
  cell,
  staffName,
  dateKey
) {

  closeLeaveMenu();

  selectedCell = {
    cell,
    staffName,
    dateKey
  };


  const menu =
    document.getElementById(
      "shiftMenu"
    );

  const buttons =
    document.getElementById(
      "shiftMenuButtons"
    );


  if (
    !menu ||
    !buttons
  ) {
    return;
  }


  buttons.innerHTML = "";


  appData.shiftTypes.forEach(
    shift => {

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "menu-button";

      button.textContent =
        shift.name;

      button.addEventListener(
        "click",
        () => {

          setShift(
            staffName,
            dateKey,
            shift.name
          );

        }
      );

      buttons.appendChild(
        button
      );

    }
  );


  const deleteButton =
    document.createElement(
      "button"
    );

  deleteButton.type =
    "button";

  deleteButton.className =
    "menu-button menu-delete";

  deleteButton.textContent =
    "削除";

  deleteButton.addEventListener(
    "click",
    () => {

      deleteCellData(
        staffName,
        dateKey
      );

    }
  );

  buttons.appendChild(
    deleteButton
  );


  if (
    appData.leaveTypes.length > 0
  ) {

    const leaveButton =
      document.createElement(
        "button"
      );

    leaveButton.type =
      "button";

    leaveButton.className =
      "menu-button menu-leave";

    leaveButton.textContent =
      "休暇";

    leaveButton.addEventListener(
      "click",
      () => {

        openLeaveMenu();

      }
    );

    buttons.appendChild(
      leaveButton
    );

  }


  positionMenu(
    menu,
    cell
  );

}


function positionMenu(
  menu,
  cell
) {

  menu.style.display =
    "block";

  const rect =
    cell.getBoundingClientRect();

  let left =
    rect.left +
    window.scrollX;

  let top =
    rect.bottom +
    window.scrollY +
    6;


  const menuWidth =
    210;


  if (
    left + menuWidth >
    window.innerWidth +
      window.scrollX -
      10
  ) {

    left =
      window.innerWidth +
      window.scrollX -
      menuWidth -
      10;

  }


  menu.style.left =
    `${Math.max(
      10,
      left
    )}px`;

  menu.style.top =
    `${top}px`;

}


function closeShiftMenu() {

  const menu =
    document.getElementById(
      "shiftMenu"
    );

  if (menu) {

    menu.style.display =
      "none";

  }

}


/* =========================
   休暇メニュー
========================= */

function openLeaveMenu() {

  closeShiftMenu();


  if (!selectedCell) {
    return;
  }


  const menu =
    document.getElementById(
      "leaveMenu"
    );

  const buttons =
    document.getElementById(
      "leaveMenuButtons"
    );


  if (
    !menu ||
    !buttons
  ) {
    return;
  }


  buttons.innerHTML = "";


  appData.leaveTypes.forEach(
    leave => {

      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "menu-button";

      button.textContent =
        leave.name;

      button.style.backgroundColor =
        leave.color || "#d9f2df";

      button.addEventListener(
        "click",
        () => {

          setLeave(
            selectedCell.staffName,
            selectedCell.dateKey,
            leave.name
          );

        }
      );

      buttons.appendChild(
        button
      );

    }
  );


  const clearButton =
    document.createElement(
      "button"
    );

  clearButton.type =
    "button";

  clearButton.className =
    "menu-button menu-clear";

  clearButton.textContent =
    "休暇を解除";

  clearButton.addEventListener(
    "click",
    () => {

      deleteLeave(
        selectedCell.staffName,
        selectedCell.dateKey
      );

    }
  );

  buttons.appendChild(
    clearButton
  );


  const cancelButton =
    document.createElement(
      "button"
    );

  cancelButton.type =
    "button";

  cancelButton.className =
    "menu-button menu-cancel";

  cancelButton.textContent =
    "キャンセル";

  cancelButton.addEventListener(
    "click",
    closeLeaveMenu
  );

  buttons.appendChild(
    cancelButton
  );


  menu.style.display =
    "block";


  const cell =
    selectedCell.cell;

  positionMenu(
    menu,
    cell
  );

}


function closeLeaveMenu() {

  const menu =
    document.getElementById(
      "leaveMenu"
    );

  if (menu) {

    menu.style.display =
      "none";

  }

}


/* =========================
   勤務登録
========================= */

async function setShift(
  staffName,
  dateKey,
  shiftName
) {

  closeShiftMenu();


  if (!appData.shifts[staffName]) {

    appData.shifts[staffName] =
      {};

  }


  if (!appData.leaves[staffName]) {

    appData.leaves[staffName] =
      {};

  }


  delete appData.leaves[
    staffName
  ][dateKey];


  appData.shifts[
    staffName
  ][dateKey] =
    shiftName;


  renderSchedule();

  saveLocalData();


  await upsertWorkShift(
    staffName,
    dateKey,
    shiftName,
    null
  );

}


async function setLeave(
  staffName,
  dateKey,
  leaveName
) {

  closeLeaveMenu();


  if (!appData.leaves[staffName]) {

    appData.leaves[staffName] =
      {};

  }


  if (!appData.shifts[staffName]) {

    appData.shifts[staffName] =
      {};

  }


  delete appData.shifts[
    staffName
  ][dateKey];


  appData.leaves[
    staffName
  ][dateKey] =
    leaveName;


  renderSchedule();

  saveLocalData();


  await upsertWorkShift(
    staffName,
    dateKey,
    null,
    leaveName
  );

}


async function deleteCellData(
  staffName,
  dateKey
) {

  closeShiftMenu();


  if (
    appData.shifts[staffName]
  ) {

    delete appData.shifts[
      staffName
    ][dateKey];

  }


  if (
    appData.leaves[staffName]
  ) {

    delete appData.leaves[
      staffName
    ][dateKey];

  }


  renderSchedule();

  saveLocalData();


  await deleteWorkShift(
    staffName,
    dateKey
  );

}


async function deleteLeave(
  staffName,
  dateKey
) {

  closeLeaveMenu();


  if (
    appData.leaves[staffName]
  ) {

    delete appData.leaves[
      staffName
    ][dateKey];

  }


  renderSchedule();

  saveLocalData();


  await deleteWorkShift(
    staffName,
    dateKey
  );

}


/* =========================
   Supabase 勤務
========================= */

async function upsertWorkShift(
  staffName,
  dateKey,
  shiftName,
  leaveType
) {

  try {

    cloudOperationBusy =
      true;


    const { error } =
      await supabaseClient
        .from("work_shifts")
        .upsert(
          {
            staff_name:
              staffName,

            work_date:
              dateKey,

            shift_name:
              shiftName,

            leave_type:
              leaveType
          },
          {
            onConflict:
              "staff_name,work_date"
          }
        );


    if (error) {

      console.error(
        "勤務保存エラー",
        error
      );

      alert(
        "保存できませんでした。\n" +
        error.message
      );

    }

  } catch (error) {

    console.error(error);

  } finally {

    cloudOperationBusy =
      false;

  }

}


async function deleteWorkShift(
  staffName,
  dateKey
) {

  try {

    cloudOperationBusy =
      true;


    const { error } =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          dateKey
        );


    if (error) {

      console.error(
        "勤務削除エラー",
        error
      );

    }

  } catch (error) {

    console.error(error);

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* =========================
   職員
========================= */

async function addStaff() {

  const input =
    document.getElementById(
      "staffNameInput"
    );

  if (!input) {
    return;
  }


  const name =
    input.value.trim();


  if (!name) {

    alert(
      "職員名を入力してください。"
    );

    return;

  }


  if (
    name === "明"
  ) {

    alert(
      "「明」は登録できません。"
    );

    return;

  }


  if (
    appData.staff.some(
      x => x.name === name
    )
  ) {

    alert(
      "同じ職員名があります。"
    );

    return;

  }


  if (
    editingStaffIndex >= 0
  ) {

    await updateStaff(
      editingStaffIndex,
      name
    );

    editingStaffIndex =
      -1;

  } else {

    const sortOrder =
      appData.staff.length + 1;


    const { data, error } =
      await supabaseClient
        .from("staff")
        .insert(
          {
            name,
            sort_order:
              sortOrder
          }
        )
        .select()
        .single();


    if (error) {

      console.error(
        error
      );

      alert(
        "職員を登録できませんでした。\n" +
        error.message
      );

      return;

    }


    appData.staff.push(
      data
    );

  }


  input.value = "";

  renderAll();

  saveLocalData();

}


function renderStaffList() {

  const list =
    document.getElementById(
      "staffList"
    );

  const count =
    document.getElementById(
      "staffCount"
    );


  if (!list) {
    return;
  }


  list.innerHTML = "";


  if (count) {

    count.textContent =
      `職員数：${appData.staff.length}人`;

  }


  appData.staff.forEach(
    (staff, index) => {

      const item =
        createManagementItem();

      const text =
        document.createElement(
          "div"
        );

      text.className =
        "item-main";

      text.textContent =
        staff.name;


      const actions =
        createActions();


      actions.appendChild(
        createButton(
          "編集",
          "edit-button",
          () => {

            const input =
              document.getElementById(
                "staffNameInput"
              );

            input.value =
              staff.name;

            editingStaffIndex =
              index;

            input.focus();

          }
        )
      );


      actions.appendChild(
        createButton(
          "削除",
          "delete-button",
          () => {

            deleteStaff(
              staff,
              index
            );

          }
        )
      );


      item.appendChild(text);

      item.appendChild(actions);

      list.appendChild(item);

    }
  );

}


async function updateStaff(
  index,
  newName
) {

  const staff =
    appData.staff[index];

  if (!staff) {
    return;
  }


  const oldName =
    staff.name;


  const { error } =
    await supabaseClient
      .from("staff")
      .update({
        name: newName
      })
      .eq(
        "id",
        staff.id
      );


  if (error) {

    alert(
      "職員名を変更できませんでした。\n" +
      error.message
    );

    return;

  }


  await supabaseClient
    .from("work_shifts")
    .update({
      staff_name:
        newName
    })
    .eq(
      "staff_name",
      oldName
    );


  appData.staff[index].name =
    newName;


  appData.shifts[newName] =
    appData.shifts[oldName] ||
    {};

  appData.leaves[newName] =
    appData.leaves[oldName] ||
    {};


  delete appData.shifts[
    oldName
  ];

  delete appData.leaves[
    oldName
  ];

}


/* =========================
   職員削除
========================= */

async function deleteStaff(
  staff,
  index
) {

  if (
    !confirm(
      `${staff.name}を削除しますか？`
    )
  ) {
    return;
  }


  await supabaseClient
    .from("work_shifts")
    .delete()
    .eq(
      "staff_name",
      staff.name
    );


  const { error } =
    await supabaseClient
      .from("staff")
      .delete()
      .eq(
        "id",
        staff.id
      );


  if (error) {

    alert(
      "削除できませんでした。\n" +
      error.message
    );

    return;

  }


  appData.staff.splice(
    index,
    1
  );


  delete appData.shifts[
    staff.name
  ];

  delete appData.leaves[
    staff.name
  ];


  renderAll();

  saveLocalData();

}


/* =========================
   勤務形態
========================= */

async function addShiftType() {

  const nameInput =
    document.getElementById(
      "shiftNameInput"
    );

  const startInput =
    document.getElementById(
      "shiftStartInput"
    );

  const endInput =
    document.getElementById(
      "shiftEndInput"
    );

  const breakInput =
    document.getElementById(
      "shiftBreakInput"
    );


  const name =
    nameInput.value.trim();


  if (!name) {

    alert(
      "勤務形態名を入力してください。"
    );

    return;

  }


  if (
    editingShiftIndex >= 0
  ) {

    await updateShiftType(
      editingShiftIndex,
      name,
      startInput.value,
      endInput.value,
      breakInput.value
    );

    editingShiftIndex =
      -1;

  } else {

    const { data, error } =
      await supabaseClient
        .from("shift_types")
        .insert({
          name,
          start_time:
            startInput.value || null,
          end_time:
            endInput.value || null,
          break_time:
            breakInput.value || null
        })
        .select()
        .single();


    if (error) {

      alert(
        "勤務形態を登録できませんでした。\n" +
        error.message
      );

      return;

    }


    appData.shiftTypes.push(
      data
    );

  }


  nameInput.value = "";

  startInput.value = "";

  endInput.value = "";

  breakInput.value = "";

  renderAll();

  saveLocalData();

}


function renderShiftList() {

  const list =
    document.getElementById(
      "shiftList"
    );

  if (!list) {
    return;
  }


  list.innerHTML = "";


  appData.shiftTypes.forEach(
    (shift, index) => {

      const item =
        createManagementItem();


      const text =
        document.createElement(
          "div"
        );

      text.className =
        "item-main";


      let detail =
        shift.name;


      if (
        shift.start_time ||
        shift.end_time
      ) {

        detail +=
          `　${shift.start_time || ""}～${shift.end_time || ""}`;

      }


      if (
        shift.break_time
      ) {

        detail +=
          `　休憩 ${shift.break_time}`;

      }


      text.textContent =
        detail;


      const actions =
        createActions();


      actions.appendChild(
        createButton(
          "編集",
          "edit-button",
          () => {

            document.getElementById(
              "shiftNameInput"
            ).value =
              shift.name;

            document.getElementById(
              "shiftStartInput"
            ).value =
              shift.start_time || "";

            document.getElementById(
              "shiftEndInput"
            ).value =
              shift.end_time || "";

            document.getElementById(
              "shiftBreakInput"
            ).value =
              shift.break_time || "";

            editingShiftIndex =
              index;

          }
        )
      );


      actions.appendChild(
        createButton(
          "削除",
          "delete-button",
          () => {

            deleteShiftType(
              shift
            );

          }
        )
      );


      item.appendChild(text);

      item.appendChild(actions);

      list.appendChild(item);

    }
  );

}


async function updateShiftType(
  index,
  name,
  startTime,
  endTime,
  breakTime
) {

  const shift =
    appData.shiftTypes[index];


  if (!shift) {
    return;
  }


  const oldName =
    shift.name;


  const { error } =
    await supabaseClient
      .from("shift_types")
      .update({
        name,
        start_time:
          startTime || null,
        end_time:
          endTime || null,
        break_time:
          breakTime || null
      })
      .eq(
        "id",
        shift.id
      );


  if (error) {

    alert(
      "変更できませんでした。\n" +
      error.message
    );

    return;

  }


  await supabaseClient
    .from("work_shifts")
    .update({
      shift_name:
        name
    })
    .eq(
      "shift_name",
      oldName
    );


  shift.name =
    name;

  shift.start_time =
    startTime || null;

  shift.end_time =
    endTime || null;

  shift.break_time =
    breakTime || null;


  Object.keys(
    appData.shifts
  ).forEach(
    staff => {

      if (
        appData.shifts[staff]
      ) {

        Object.keys(
          appData.shifts[staff]
        ).forEach(
          date => {

            if (
              appData.shifts[staff][date] ===
              oldName
            ) {

              appData.shifts[staff][date] =
                name;

            }

          }
        );

      }

    }
  );

}


async function deleteShiftType(
  shift
) {

  const used =
    Object.values(
      appData.shifts
    ).some(
      staffShifts =>
        Object.values(
          staffShifts || {}
        ).includes(
          shift.name
        )
    );


  if (used) {

    alert(
      "この勤務形態は勤務表で使用されているため削除できません。"
    );

    return;

  }


  if (
    !confirm(
      `${shift.name}を削除しますか？`
    )
  ) {
    return;
  }


  const { error } =
    await supabaseClient
      .from("shift_types")
      .delete()
      .eq(
        "id",
        shift.id
      );


  if (error) {

    alert(
      "削除できませんでした。\n" +
      error.message
    );

    return;

  }


  appData.shiftTypes =
    appData.shiftTypes.filter(
      x =>
        x.id !== shift.id
    );


  renderAll();

  saveLocalData();

}


/* =========================
   休業日
========================= */

async function addCompanyHoliday() {

  const nameInput =
    document.getElementById(
      "companyHolidayName"
    );

  const startInput =
    document.getElementById(
      "companyHolidayStart"
    );

  const endInput =
    document.getElementById(
      "companyHolidayEnd"
    );


  const name =
    nameInput.value.trim();

  const start =
    startInput.value;

  const end =
    endInput.value || start;


  if (
    !name ||
    !start
  ) {

    alert(
      "休業日名と開始日を入力してください。"
    );

    return;

  }


  if (
    editingHolidayId
  ) {

    await updateHoliday(
      editingHolidayId,
      name,
      start,
      end
    );

    editingHolidayId =
      null;

  } else {

    const { data, error } =
      await supabaseClient
        .from(
          "company_holidays"
        )
        .insert({
          name,
          start_date:
            start,
          end_date:
            end
        })
        .select()
        .single();


    if (error) {

      alert(
        "休業日を登録できませんでした。\n" +
        error.message
      );

      return;

    }


    appData.companyHolidays.push(
      data
    );

  }


  nameInput.value = "";

  startInput.value = "";

  endInput.value = "";

  renderAll();

  saveLocalData();

}


function renderCompanyHolidayList() {

  const list =
    document.getElementById(
      "companyHolidayList"
    );

  if (!list) {
    return;
  }


  list.innerHTML = "";


  appData.companyHolidays.forEach(
    holiday => {

      const item =
        createManagementItem();


      const text =
        document.createElement(
          "div"
        );

      text.className =
        "item-main";

      text.textContent =
        `${holiday.name}　${holiday.start_date} ～ ${holiday.end_date}`;


      const actions =
        createActions();


      actions.appendChild(
        createButton(
          "編集",
          "edit-button",
          () => {

            document.getElementById(
              "companyHolidayName"
            ).value =
              holiday.name;

            document.getElementById(
              "companyHolidayStart"
            ).value =
              holiday.start_date;

            document.getElementById(
              "companyHolidayEnd"
            ).value =
              holiday.end_date;

            editingHolidayId =
              holiday.id;

          }
        )
      );


      actions.appendChild(
        createButton(
          "削除",
          "delete-button",
          () => {

            deleteHoliday(
              holiday.id
            );

          }
        )
      );


      item.appendChild(text);

      item.appendChild(actions);

      list.appendChild(item);

    }
  );

}


async function updateHoliday(
  id,
  name,
  start,
  end
) {

  const { error } =
    await supabaseClient
      .from(
        "company_holidays"
      )
      .update({
        name,
        start_date:
          start,
        end_date:
          end
      })
      .eq(
        "id",
        id
      );


  if (error) {

    alert(
      "変更できませんでした。\n" +
      error.message
    );

    return;

  }


  const holiday =
    appData.companyHolidays.find(
      x =>
        x.id === id
    );


  if (holiday) {

    holiday.name =
      name;

    holiday.start_date =
      start;

    holiday.end_date =
      end;

  }

}


async function deleteHoliday(
  id
) {

  if (
    !confirm(
      "この休業日を削除しますか？"
    )
  ) {
    return;
  }


  const { error } =
    await supabaseClient
      .from(
        "company_holidays"
      )
      .delete()
      .eq(
        "id",
        id
      );


  if (error) {

    alert(
      "削除できませんでした。\n" +
      error.message
    );

    return;

  }


  appData.companyHolidays =
    appData.companyHolidays.filter(
      x =>
        x.id !== id
    );


  renderAll();

  saveLocalData();

}


/* =========================
   休暇種類
========================= */

async function addLeaveType() {

  const nameInput =
    document.getElementById(
      "leaveTypeNameInput"
    );

  const colorInput =
    document.getElementById(
      "leaveTypeColorInput"
    );


  if (
    !nameInput ||
    !colorInput
  ) {
    return;
  }


  const name =
    nameInput.value.trim();

  const color =
    colorInput.value ||
    "#d9f2df";


  if (!name) {

    alert(
      "休暇種類名を入力してください。"
    );

    return;

  }


  if (
    editingLeaveTypeId
  ) {

    await updateLeaveType(
      editingLeaveTypeId,
      name,
      color
    );

    editingLeaveTypeId =
      null;

  } else {

    const exists =
      appData.leaveTypes.some(
        x =>
          x.name === name
      );


    if (exists) {

      alert(
        "同じ休暇種類があります。"
      );

      return;

    }


    const { data, error } =
      await supabaseClient
        .from("leave_types")
        .insert({
          name,
          color
        })
        .select()
        .single();


    if (error) {

      alert(
        "休暇種類を登録できませんでした。\n" +
        error.message
      );

      return;

    }


    appData.leaveTypes.push(
      data
    );

  }


  nameInput.value = "";

  colorInput.value =
    "#d9f2df";


  renderAll();

  saveLocalData();

}


function renderLeaveTypeList() {

  const list =
    document.getElementById(
      "leaveTypeList"
    );

  if (!list) {
    return;
  }


  list.innerHTML = "";


  appData.leaveTypes.forEach(
    leave => {

      const item =
        createManagementItem();


      const text =
        document.createElement(
          "div"
        );

      text.className =
        "item-main leave-item-main";


      const color =
        document.createElement(
          "span"
        );

      color.className =
        "leave-color";

      color.style.backgroundColor =
        leave.color ||
        "#d9f2df";


      const name =
        document.createElement(
          "span"
        );

      name.textContent =
        leave.name;


      text.appendChild(color);

      text.appendChild(name);


      const actions =
        createActions();


      actions.appendChild(
        createButton(
          "編集",
          "edit-button",
          () => {

            document.getElementById(
              "leaveTypeNameInput"
            ).value =
              leave.name;

            document.getElementById(
              "leaveTypeColorInput"
            ).value =
              leave.color ||
              "#d9f2df";

            editingLeaveTypeId =
              leave.id;

            document.getElementById(
              "leaveTypeNameInput"
            ).focus();

          }
        )
      );


      actions.appendChild(
        createButton(
          "削除",
          "delete-button",
          () => {

            deleteLeaveType(
              leave
            );

          }
        )
      );


      item.appendChild(text);

      item.appendChild(actions);

      list.appendChild(item);

    }
  );

}


async function updateLeaveType(
  id,
  newName,
  newColor
) {

  const leave =
    appData.leaveTypes.find(
      x =>
        x.id === id
    );


  if (!leave) {
    return;
  }


  const oldName =
    leave.name;


  const { error } =
    await supabaseClient
      .from("leave_types")
      .update({
        name:
          newName,
        color:
          newColor
      })
      .eq(
        "id",
        id
      );


  if (error) {

    alert(
      "休暇種類を変更できませんでした。\n" +
      error.message
    );

    return;

  }


  await supabaseClient
    .from("work_shifts")
    .update({
      leave_type:
        newName
    })
    .eq(
      "leave_type",
      oldName
    );


  Object.keys(
    appData.leaves
  ).forEach(
    staff => {

      Object.keys(
        appData.leaves[staff] || {}
      ).forEach(
        date => {

          if (
            appData.leaves[staff][date] ===
            oldName
          ) {

            appData.leaves[staff][date] =
              newName;

          }

        }
      );

    }
  );


  leave.name =
    newName;

  leave.color =
    newColor;

}


async function deleteLeaveType(
  leave
) {

  const used =
    Object.values(
      appData.leaves
    ).some(
      staffLeaves =>
        Object.values(
          staffLeaves || {}
        ).includes(
          leave.name
        )
    );


  if (used) {

    alert(
      "この休暇種類は勤務表で使用されているため削除できません。"
    );

    return;

  }


  if (
    !confirm(
      `${leave.name}を削除しますか？`
    )
  ) {
    return;
  }


  const { error } =
    await supabaseClient
      .from("leave_types")
      .delete()
      .eq(
        "id",
        leave.id
      );


  if (error) {

    alert(
      "削除できませんでした。\n" +
      error.message
    );

    return;

  }


  appData.leaveTypes =
    appData.leaveTypes.filter(
      x =>
        x.id !== leave.id
    );


  renderAll();

  saveLocalData();

}


/* =========================
   「明」設定
========================= */

function renderAkeTime() {

  const start =
    document.getElementById(
      "akeStartInput"
    );

  const end =
    document.getElementById(
      "akeEndInput"
    );


  if (start) {

    start.value =
      appData.akeTime.start;

  }

  if (end) {

    end.value =
      appData.akeTime.end;

  }

}


async function saveAkeTime() {

  const start =
    document.getElementById(
      "akeStartInput"
    ).value;

  const end =
    document.getElementById(
      "akeEndInput"
    ).value;


  appData.akeTime = {
    start,
    end
  };


  await upsertAppSetting(
    "ake_start",
    start
  );

  await upsertAppSetting(
    "ake_end",
    end
  );


  saveLocalData();

  renderSchedule();

  alert(
    "保存しました。"
  );

}


async function upsertAppSetting(
  name,
  value
) {

  const { error } =
    await supabaseClient
      .from("app_settings")
      .upsert(
        {
          setting_name:
            name,

          setting_value:
            value
        },
        {
          onConflict:
            "setting_name"
        }
      );


  if (error) {

    console.error(
      "設定保存エラー",
      error
    );

  }

}


/* =========================
   今月削除
========================= */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  const start =
    formatDate(
      new Date(
        year,
        month,
        1
      )
    );

  const end =
    formatDate(
      new Date(
        year,
        month + 1,
        0
      )
    );


  if (
    !confirm(
      `${year}年${month + 1}月の勤務をすべて削除しますか？`
    )
  ) {
    return;
  }


  const { error } =
    await supabaseClient
      .from("work_shifts")
      .delete()
      .gte(
        "work_date",
        start
      )
      .lte(
        "work_date",
        end
      );


  if (error) {

    alert(
      "削除できませんでした。\n" +
      error.message
    );

    return;

  }


  appData.staff.forEach(
    staff => {

      if (
        appData.shifts[staff.name]
      ) {

        Object.keys(
          appData.shifts[staff.name]
        ).forEach(
          date => {

            if (
              date >= start &&
              date <= end
            ) {

              delete appData.shifts[
                staff.name
              ][date];

            }

          }
        );

      }


      if (
        appData.leaves[staff.name]
      ) {

        Object.keys(
          appData.leaves[staff.name]
        ).forEach(
          date => {

            if (
              date >= start &&
              date <= end
            ) {

              delete appData.leaves[
                staff.name
              ][date];

            }

          }
        );

      }

    }
  );


  saveLocalData();

  renderSchedule();

}


/* =========================
   年度削除
========================= */

async function deleteFiscalYear() {

  const year =
    currentDate.getFullYear();

  const fiscalStartYear =
    currentDate.getMonth() >= 3
      ? year
      : year - 1;


  const start =
    `${fiscalStartYear}-04-01`;

  const end =
    `${fiscalStartYear + 1}-03-31`;


  if (
    !confirm(
      `${fiscalStartYear}年度の勤務をすべて削除しますか？`
    )
  ) {
    return;
  }


  const { error } =
    await supabaseClient
      .from("work_shifts")
      .delete()
      .gte(
        "work_date",
        start
      )
      .lte(
        "work_date",
        end
      );


  if (error) {

    alert(
      "削除できませんでした。\n" +
      error.message
    );

    return;

  }


  appData.staff.forEach(
    staff => {

      [
        appData.shifts,
        appData.leaves
      ].forEach(
        collection => {

          if (
            collection[staff.name]
          ) {

            Object.keys(
              collection[staff.name]
            ).forEach(
              date => {

                if (
                  date >= start &&
                  date <= end
                ) {

                  delete collection[
                    staff.name
                  ][date];

                }

              }
            );

          }

        }
      );

    }
  );


  saveLocalData();

  renderSchedule();

}


/* =========================
   管理画面共通
========================= */

function createManagementItem() {

  const item =
    document.createElement(
      "div"
    );

  item.className =
    "management-item";

  return item;

}


function createActions() {

  const actions =
    document.createElement(
      "div"
    );

  actions.className =
    "item-actions";

  return actions;

}


function createButton(
  text,
  className,
  callback
) {

  const button =
    document.createElement(
      "button"
    );

  button.type =
    "button";

  button.textContent =
    text;

  button.className =
    className;

  button.addEventListener(
    "click",
    callback
  );

  return button;

}


/* =========================
   カレンダー
========================= */

function openCalendarConfirm(
  staffName
) {

  selectedCalendarStaff =
    staffName;


  const modal =
    document.getElementById(
      "calendarConfirm"
    );

  const title =
    document.getElementById(
      "calendarConfirmTitle"
    );

  const text =
    document.getElementById(
      "calendarConfirmText"
    );


  if (
    title
  ) {

    title.textContent =
      `${staffName}の勤務表`;

  }

  if (
    text
  ) {

    text.textContent =
      "この月の勤務をカレンダーに登録しますか？";

  }

  if (modal) {

    modal.style.display =
      "flex";

  }

}


function closeCalendarConfirm() {

  const modal =
    document.getElementById(
      "calendarConfirm"
    );

  if (modal) {

    modal.style.display =
      "none";

  }

}


function exportCalendar() {

  if (
    !selectedCalendarStaff
  ) {
    return;
  }


  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();

  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  let ics =
    "BEGIN:VCALENDAR\r\n";

  ics +=
    "VERSION:2.0\r\n";

  ics +=
    "PRODID:-//勤務表//JP\r\n";


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const date =
      new Date(
        year,
        month,
        day
      );

    const dateKey =
      formatDate(date);

    const shift =
      getShift(
        selectedCalendarStaff,
        dateKey
      );

    const leave =
      getLeave(
        selectedCalendarStaff,
        dateKey
      );


    if (
      !shift &&
      !leave
    ) {
      continue;
    }


    const title =
      leave
        ? leave
        : shift;


    const dateString =
      `${year}${String(
        month + 1
      ).padStart(
        2,
        "0"
      )}${String(
        day
      ).padStart(
        2,
        "0"
      )}`;


    ics +=
      "BEGIN:VEVENT\r\n";

    ics +=
      `UID:${selectedCalendarStaff}-${dateString}@workSchedule\r\n`;

    ics +=
      `DTSTART;VALUE=DATE:${dateString}\r\n`;

    ics +=
      `DTEND;VALUE=DATE:${dateString}\r\n`;

    ics +=
      `SUMMARY:${escapeICS(title)}\r\n`;

    ics +=
      "END:VEVENT\r\n";

  }


  ics +=
    "END:VCALENDAR\r\n";


  const blob =
    new Blob(
      [ics],
      {
        type:
          "text/calendar;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const a =
    document.createElement(
      "a"
    );

  a.href =
    url;

  a.download =
    `${selectedCalendarStaff}_${year}年${month + 1}月.ics`;

  a.click();


  URL.revokeObjectURL(
    url
  );


  closeCalendarConfirm();

}


function escapeICS(
  text
) {

  return String(text)
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /;/g,
      "\\;"
    )
    .replace(
      /,/g,
      "\\,"
    )
    .replace(
      /\n/g,
      "\\n"
    );

}


/* =========================
   Realtime
========================= */

function setupRealtime() {

  if (
    realtimeChannel
  ) {

    supabaseClient.removeChannel(
      realtimeChannel
    );

  }


  realtimeChannel =
    supabaseClient
      .channel(
        "work-schedule-realtime"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff"
        },
        scheduleRealtimeReload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shift_types"
        },
        scheduleRealtimeReload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_shifts"
        },
        scheduleRealtimeReload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_holidays"
        },
        scheduleRealtimeReload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_types"
        },
        scheduleRealtimeReload
      )
      .subscribe();

}


function scheduleRealtimeReload() {

  clearTimeout(
    realtimeReloadTimer
  );


  realtimeReloadTimer =
    setTimeout(
      () => {

        if (
          !cloudOperationBusy
        ) {

          loadAllFromSupabase();

        }

      },
      500
    );

}


/* =========================
   自動同期
========================= */

function startAutoSync() {

  clearInterval(
    autoSyncTimer
  );


  autoSyncTimer =
    setInterval(
      () => {

        if (
          !cloudOperationBusy
        ) {

          loadAllFromSupabase();

        }

      },
      10000
    );

}
