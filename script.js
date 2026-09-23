"use strict";

/* =========================================================
   勤務表アプリ
   ========================================================= */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

const LOCAL_STORAGE_KEY = "workScheduleAppData";

/*
 * webcal配信用Edge Function
 *
 * 以前使っていたFunction名が違う場合は
 * この1行だけ変更してください。
 */
const CALENDAR_FEED_PATH =
  "/functions/v1/calendar-feed";


/* =========================================================
   DOM
   ========================================================= */

const $ = (id) => document.getElementById(id);

const $$ = (selector) =>
  Array.from(document.querySelectorAll(selector));


/* =========================================================
   データ
   ========================================================= */

const defaultAppData = () => ({
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
});

let appData = defaultAppData();

let currentDate = new Date();
currentDate.setDate(1);

let editingStaffIndex = -1;
let editingShiftIndex = -1;
let editingHolidayId = null;
let editingLeaveTypeId = null;

let selectedCell = null;
let selectedCalendarStaff = null;

let publicHolidays = {};

let supabaseClient = null;
let realtimeChannel = null;
let realtimeReloadTimer = null;
let autoSyncTimer = null;

let leaveMenuOpen = false;
let cloudOperationBusy = false;


/* =========================================================
   起動
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

  try {

    loadLocal();

    initSupabase();

    bindEvents();

    renderAll();

    await fetchPublicHolidays();

    await loadAllFromSupabase();

    setupRealtime();

    startAutoSync();

    setStatus("同期済み");

  } catch (error) {

    console.error(error);

    setStatus("起動時エラー", "error");

    renderAll();

  }

});


/* =========================================================
   Supabase
   ========================================================= */

function initSupabase() {

  if (
    window.supabase &&
    typeof window.supabase.createClient === "function"
  ) {

    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

  } else {

    console.warn(
      "Supabaseライブラリが読み込まれていません。"
    );

  }

}


/* =========================================================
   ローカル保存
   ========================================================= */

function saveLocal() {

  try {

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(appData)
    );

  } catch (error) {

    console.error(
      "ローカル保存エラー",
      error
    );

  }

}


function loadLocal() {

  try {

    const saved =
      localStorage.getItem(
        LOCAL_STORAGE_KEY
      );

    if (!saved) {

      appData = defaultAppData();

      return;

    }

    const parsed =
      JSON.parse(saved);

    appData = {
      ...defaultAppData(),
      ...parsed,

      staff:
        Array.isArray(parsed.staff)
          ? parsed.staff
          : [],

      shiftTypes:
        Array.isArray(parsed.shiftTypes)
          ? parsed.shiftTypes
          : [],

      leaveTypes:
        Array.isArray(parsed.leaveTypes)
          ? parsed.leaveTypes
          : [],

      companyHolidays:
        Array.isArray(parsed.companyHolidays)
          ? parsed.companyHolidays
          : [],

      shifts:
        parsed.shifts &&
        typeof parsed.shifts === "object"
          ? parsed.shifts
          : {},

      leaves:
        parsed.leaves &&
        typeof parsed.leaves === "object"
          ? parsed.leaves
          : {},

      akeTime: {
        start:
          parsed.akeTime?.start ||
          "05:30",

        end:
          parsed.akeTime?.end ||
          "11:15"
      }
    };

  } catch (error) {

    console.error(
      "ローカルデータ読み込みエラー",
      error
    );

    appData =
      defaultAppData();

  }

}


/* =========================================================
   ステータス
   ========================================================= */

function setStatus(text, type = "") {

  const el = $("appStatus");

  if (!el) return;

  el.textContent = text;

  el.className =
    "app-status" +
    (type ? ` ${type}` : "");

}


/* =========================================================
   Supabase読み込み
   ========================================================= */

async function loadAllFromSupabase(silent = false) {

  if (!supabaseClient) {

    return false;

  }

  if (!silent) {

    setStatus("データ取得中...");

  }

  let successCount = 0;

  /* -------------------------
     職員
     ------------------------- */

  try {

    const result =
      await supabaseClient
        .from("staff")
        .select(
          "id,name,created_at,sort_order,calendar_token"
        );

    if (result.error) {

      console.error(
        "staff取得エラー",
        result.error
      );

    } else {

      appData.staff =
        (result.data || [])
          .filter(
            item =>
              item.name !== "明"
          )
          .sort(
            (a, b) => {

              const ao =
                Number.isFinite(
                  Number(a.sort_order)
                )
                  ? Number(a.sort_order)
                  : 999999;

              const bo =
                Number.isFinite(
                  Number(b.sort_order)
                )
                  ? Number(b.sort_order)
                  : 999999;

              if (ao !== bo) {

                return ao - bo;

              }

              return String(
                a.created_at || ""
              ).localeCompare(
                String(
                  b.created_at || ""
                )
              );

            }
          );

      successCount++;

    }

  } catch (error) {

    console.error(
      "staff取得例外",
      error
    );

  }


  /* -------------------------
     勤務形態
     ------------------------- */

  try {

    const result =
      await supabaseClient
        .from("shift_types")
        .select(
          "id,name,created_at,start_time,end_time,break_time"
        );

    if (result.error) {

      console.error(
        "shift_types取得エラー",
        result.error
      );

    } else {

      appData.shiftTypes =
        result.data || [];

      successCount++;

    }

  } catch (error) {

    console.error(
      "shift_types取得例外",
      error
    );

  }


  /* -------------------------
     休暇種類
     ------------------------- */

  try {

    const result =
      await supabaseClient
        .from("leave_types")
        .select(
          "id,name,color,created_at"
        )
        .order(
          "id",
          {
            ascending: true
          }
        );

    if (result.error) {

      console.error(
        "leave_types取得エラー",
        result.error
      );

    } else {

      appData.leaveTypes =
        result.data || [];

      successCount++;

    }

  } catch (error) {

    console.error(
      "leave_types取得例外",
      error
    );

  }


  /* -------------------------
     休業日
     ------------------------- */

  try {

    const result =
      await supabaseClient
        .from("company_holidays")
        .select(
          "id,name,start_date,end_date,created_at"
        )
        .order(
          "start_date",
          {
            ascending: true
          }
        );

    if (result.error) {

      console.error(
        "company_holidays取得エラー",
        result.error
      );

    } else {

      appData.companyHolidays =
        result.data || [];

      successCount++;

    }

  } catch (error) {

    console.error(
      "company_holidays取得例外",
      error
    );

  }


  /* -------------------------
     勤務
     ------------------------- */

  try {

    const result =
      await supabaseClient
        .from("work_shifts")
        .select(
          "id,staff_name,work_date,shift_name,leave_type"
        );

    if (result.error) {

      console.error(
        "work_shifts取得エラー",
        result.error
      );

    } else {

      const shifts = {};
      const leaves = {};

      for (
        const row of result.data || []
      ) {

        if (!row.staff_name) {
          continue;
        }

        if (!shifts[row.staff_name]) {

          shifts[row.staff_name] = {};

        }

        if (!leaves[row.staff_name]) {

          leaves[row.staff_name] = {};

        }

        if (row.leave_type) {

          leaves[row.staff_name][
            row.work_date
          ] =
            row.leave_type;

        } else if (row.shift_name) {

          shifts[row.staff_name][
            row.work_date
          ] =
            row.shift_name;

        }

      }

      appData.shifts = shifts;
      appData.leaves = leaves;

      successCount++;

    }

  } catch (error) {

    console.error(
      "work_shifts取得例外",
      error
    );

  }


  /* -------------------------
     設定
     ------------------------- */

  try {

    const result =
      await supabaseClient
        .from("app_settings")
        .select(
          "setting_name,setting_value"
        );

    if (result.error) {

      console.error(
        "app_settings取得エラー",
        result.error
      );

    } else {

      for (
        const row of result.data || []
      ) {

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

      successCount++;

    }

  } catch (error) {

    console.error(
      "app_settings取得例外",
      error
    );

  }


  saveLocal();

  renderAll();

  if (!silent) {

    if (successCount >= 3) {

      setStatus("同期済み");

    } else {

      setStatus(
        "一部データ取得失敗",
        "error"
      );

    }

  }

  return successCount > 0;

}


/* =========================================================
   Realtime
   ========================================================= */

function setupRealtime() {

  if (
    !supabaseClient ||
    realtimeChannel
  ) {

    return;

  }

  try {

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

  } catch (error) {

    console.error(
      "Realtime設定エラー",
      error
    );

  }

}


function scheduleRealtimeReload() {

  clearTimeout(
    realtimeReloadTimer
  );

  realtimeReloadTimer =
    setTimeout(
      async () => {

        await loadAllFromSupabase(
          true
        );

        setStatus("自動同期済み");

      },
      500
    );

}


/* =========================================================
   自動同期
   ========================================================= */

function startAutoSync() {

  clearInterval(autoSyncTimer);

  autoSyncTimer =
    setInterval(
      async () => {

        if (
          document.visibilityState ===
          "visible"
        ) {

          await loadAllFromSupabase(
            true
          );

        }

      },
      10000
    );

}


document.addEventListener(
  "visibilitychange",
  async () => {

    if (
      document.visibilityState ===
      "visible"
    ) {

      await loadAllFromSupabase(
        true
      );

    }

  }
);


/* =========================================================
   イベント
   ========================================================= */

function bindEvents() {

  $$(".nav-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          showPage(
            button.dataset.page
          );

        }
      );

    });


  $("prevMonth")
    ?.addEventListener(
      "click",
      () => {

        currentDate.setMonth(
          currentDate.getMonth() - 1
        );

        renderSchedule();

      }
    );


  $("nextMonth")
    ?.addEventListener(
      "click",
      () => {

        currentDate.setMonth(
          currentDate.getMonth() + 1
        );

        renderSchedule();

      }
    );


  $("deleteMonthButton")
    ?.addEventListener(
      "click",
      deleteCurrentMonth
    );


  $("deleteFiscalYearButton")
    ?.addEventListener(
      "click",
      deleteFiscalYear
    );


  $("addStaffButton")
    ?.addEventListener(
      "click",
      saveStaff
    );


  $("addShiftButton")
    ?.addEventListener(
      "click",
      saveShiftType
    );


  $("addCompanyHolidayButton")
    ?.addEventListener(
      "click",
      saveCompanyHoliday
    );


  $("addLeaveTypeButton")
    ?.addEventListener(
      "click",
      saveLeaveType
    );


  $("saveAkeTimeButton")
    ?.addEventListener(
      "click",
      saveAkeTime
    );


  $("calendarCancelButton")
    ?.addEventListener(
      "click",
      closeCalendarModal
    );


  $("calendarOKButton")
    ?.addEventListener(
      "click",
      registerWebcal
    );


  document.addEventListener(
    "click",
    handleDocumentClick
  );

}


/* =========================================================
   ページ切り替え
   ========================================================= */

function showPage(pageName) {

  const pages = {
    schedule:
      $("schedulePage"),

    staff:
      $("staffPage"),

    shift:
      $("shiftPage"),

    holiday:
      $("holidayPage"),

    leaveType:
      $("leaveTypePage")
  };


  Object.entries(pages)
    .forEach(
      ([name, page]) => {

        if (!page) return;

        page.style.display =
          name === pageName
            ? ""
            : "none";

      }
    );


  $$(".nav-button")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
          pageName
      );

    });

}


/* =========================================================
   共通
   ========================================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


function pad2(number) {

  return String(
    number
  ).padStart(
    2,
    "0"
  );

}


function dateKey(date) {

  return (
    date.getFullYear() +
    "-" +
    pad2(date.getMonth() + 1) +
    "-" +
    pad2(date.getDate())
  );

}


function getMonthDays() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();

  const last =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  const result = [];

  for (
    let day = 1;
    day <= last;
    day++
  ) {

    result.push(
      new Date(
        year,
        month,
        day
      )
    );

  }

  return result;

}


function formatDateJapanese(
  value
) {

  const date =
    new Date(
      value + "T00:00:00"
    );

  return (
    date.getFullYear() +
    "/" +
    pad2(date.getMonth() + 1) +
    "/" +
    pad2(date.getDate())
  );

}


function getWeekday(date) {

  return [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
  ][date.getDay()];

}


/* =========================================================
   祝日
   ========================================================= */

async function fetchPublicHolidays() {

  try {

    const response =
      await fetch(
        "https://holidays-jp.github.io/api/v1/date.json"
      );

    if (!response.ok) {

      throw new Error(
        "祝日取得失敗"
      );

    }

    publicHolidays =
      await response.json();

  } catch (error) {

    console.warn(
      "祝日取得できませんでした",
      error
    );

    publicHolidays = {};

  }

}


function isPublicHoliday(key) {

  return Boolean(
    publicHolidays[key]
  );

}


function isCompanyHoliday(key) {

  return appData.companyHolidays
    .some(
      holiday => {

        if (
          !holiday.start_date
        ) {

          return false;

        }

        const start =
          holiday.start_date;

        const end =
          holiday.end_date ||
          holiday.start_date;

        return (
          key >= start &&
          key <= end
        );

      }
    );

}


/* =========================================================
   明判定
   ========================================================= */

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


function shouldShowAke(
  staffName,
  key
) {

  const date =
    new Date(
      key + "T00:00:00"
    );

  date.setDate(
    date.getDate() - 1
  );

  const previousKey =
    dateKey(date);

  const previousShift =
    appData.shifts
      [staffName]
      ?.[
        previousKey
      ];

  if (
    !previousShift
  ) {

    return false;

  }

  if (
    !isNightShiftName(
      previousShift
    )
  ) {

    return false;

  }

  if (
    appData.shifts
      [staffName]
      ?.[
        key
      ]
  ) {

    return false;

  }

  if (
    appData.leaves
      [staffName]
      ?.[
        key
      ]
  ) {

    return false;

  }

  return true;

}


/* =========================================================
   全描画
   ========================================================= */

function renderAll() {

  renderSchedule();

  renderStaffList();

  renderShiftList();

  renderCompanyHolidayList();

  renderLeaveTypeList();

  renderAkeTime();

}


/* =========================================================
   勤務表
   ========================================================= */

function renderSchedule() {

  const table =
    $("scheduleTable");

  const header =
    $("scheduleHeader");

  const body =
    $("scheduleBody");

  if (
    !table ||
    !header ||
    !body
  ) {

    return;

  }


  $("currentMonth").textContent =
    currentDate.getFullYear() +
    "年" +
    (currentDate.getMonth() + 1) +
    "月";


  const days =
    getMonthDays();


  let headerHtml =
    `<th class="staff-header">職員</th>`;


  for (
    const date of days
  ) {

    const key =
      dateKey(date);

    const holiday =
      isPublicHoliday(key) ||
      isCompanyHoliday(key);

    headerHtml += `
      <th
        class="date-header ${
          holiday
            ? "holiday-header"
            : ""
        }"
      >
        <div>${date.getDate()}</div>
        <small>${getWeekday(date)}</small>
      </th>
    `;

  }


  for (
    const shift of appData.shiftTypes
  ) {

    headerHtml += `
      <th class="count-header">
        ${escapeHtml(shift.name)}
        <small>回数</small>
      </th>
    `;

  }


  headerHtml += `
    <th class="total-header">
      合計
    </th>
  `;


  header.innerHTML =
    headerHtml;


  let bodyHtml = "";


  for (
    const staff of appData.staff
  ) {

    const staffName =
      staff.name;

    let count = 0;

    let cells = "";


    for (
      const date of days
    ) {

      const key =
        dateKey(date);

      const shift =
        appData.shifts
          [staffName]
          ?.[
            key
          ];

      const leave =
        appData.leaves
          [staffName]
          ?.[
            key
          ];


      let value = "";

      let cellClass =
        "schedule-cell";


      let cellStyle = "";


      if (leave) {

        value =
          escapeHtml(
            leave
          );

        cellClass +=
          " leave-cell";


        const leaveType =
          getLeaveType(
            leave
          );

        if (
          leaveType?.color
        ) {

          cellStyle =
            `background:${escapeHtml(
              leaveType.color
            )};`;

        }

      } else if (shift) {

        value =
          escapeHtml(
            shift
          );

        cellClass +=
          " shift-cell";

        count++;

      } else if (
        shouldShowAke(
          staffName,
          key
        )
      ) {

        value = "明";

        cellClass +=
          " ake-cell";

      }


      if (
        isPublicHoliday(key) ||
        isCompanyHoliday(key)
      ) {

        cellClass +=
          " holiday-cell";

      }


      cells += `
        <td
          class="${cellClass}"
          style="${cellStyle}"
          data-staff="${escapeHtml(staffName)}"
          data-date="${key}"
        >
          <div class="schedule-cell-inner">
            ${value}
          </div>
        </td>
      `;

    }


    let countHtml = "";


    for (
      const shift of appData.shiftTypes
    ) {

      let shiftCount = 0;

      for (
        const date of days
      ) {

        const key =
          dateKey(date);

        if (
          appData.shifts
            [staffName]
            ?.[
              key
            ] === shift.name
        ) {

          shiftCount++;

        }

      }


      countHtml += `
        <td class="count-cell">
          ${shiftCount}
        </td>
      `;

    }


    bodyHtml += `
      <tr>
        <td
          class="staff-name-cell"
          data-calendar-staff="${escapeHtml(staffName)}"
        >
          <button
            type="button"
            class="staff-calendar-button"
            data-calendar-staff="${escapeHtml(staffName)}"
          >
            ${escapeHtml(staffName)}
          </button>
        </td>

        ${cells}

        ${countHtml}

        <td class="total-cell">
          ${count}
        </td>
      </tr>
    `;

  }


  body.innerHTML =
    bodyHtml;


  $$("#scheduleBody .schedule-cell")
    .forEach(cell => {

      cell.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          const staff =
            cell.dataset.staff;

          const date =
            cell.dataset.date;


          /*
           * 休暇メニューを開いている状態で
           * 別の勤務セルをタップした場合は
           * 閉じるだけ。
           */
          if (
            leaveMenuOpen
          ) {

            closeLeaveMenu();

            return;

          }


          showShiftMenu(
            cell,
            staff,
            date
          );

        }
      );

    });


  $$(".staff-calendar-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          openCalendarModal(
            button.dataset.calendarStaff
          );

        }
      );

    });

}


/* =========================================================
   勤務メニュー
   ========================================================= */

function showShiftMenu(
  cell,
  staffName,
  date
) {

  closeLeaveMenu();

  const menu =
    $("shiftMenu");

  const buttons =
    $("shiftMenuButtons");

  if (
    !menu ||
    !buttons
  ) {

    return;

  }


  selectedCell = {
    cell,
    staffName,
    date
  };


  buttons.innerHTML = "";


  /*
   * 勤務形態
   * 2列表示
   */

  appData.shiftTypes
    .forEach(
      shift => {

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "shift-choice-button";

        button.textContent =
          shift.name;

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            setWorkShift(
              staffName,
              date,
              shift.name
            );

          }
        );

        buttons.appendChild(
          button
        );

      }
    );


  /*
   * 削除
   */

  const deleteButton =
    document.createElement(
      "button"
    );

  deleteButton.type =
    "button";

  deleteButton.className =
    "menu-wide-button danger-button";

  deleteButton.textContent =
    "削除";

  deleteButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      clearWorkShift(
        staffName,
        date
      );

    }
  );

  buttons.appendChild(
    deleteButton
  );


  /*
   * 休暇
   */

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
      "menu-wide-button leave-button";

    leaveButton.textContent =
      "休暇";

    leaveButton.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        closeShiftMenu();

        showLeaveMenu(
          staffName,
          date
        );

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


function showLeaveMenu(
  staffName,
  date
) {

  const menu =
    $("leaveMenu");

  const buttons =
    $("leaveMenuButtons");

  if (
    !menu ||
    !buttons
  ) {

    return;

  }


  leaveMenuOpen = true;


  buttons.innerHTML = "";


  appData.leaveTypes
    .forEach(
      leave => {

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "leave-choice-button";

        button.textContent =
          leave.name;

        button.style.backgroundColor =
          leave.color ||
          "#d9f2df";

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            setLeave(
              staffName,
              date,
              leave.name
            );

          }
        );

        buttons.appendChild(
          button
        );

      }
    );


  const clearLeaveButton =
    document.createElement(
      "button"
    );

  clearLeaveButton.type =
    "button";

  clearLeaveButton.className =
    "menu-wide-button danger-button";

  clearLeaveButton.textContent =
    "休暇を解除";

  clearLeaveButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      clearWorkShift(
        staffName,
        date
      );

    }
  );

  buttons.appendChild(
    clearLeaveButton
  );


  const cancelButton =
    document.createElement(
      "button"
    );

  cancelButton.type =
    "button";

  cancelButton.className =
    "menu-wide-button cancel-button";

  cancelButton.textContent =
    "キャンセル";

  cancelButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      closeLeaveMenu();

    }
  );

  buttons.appendChild(
    cancelButton
  );


  positionMenuFromCell(
    menu,
    selectedCell?.cell
  );

}


function positionMenu(
  menu,
  cell
) {

  positionMenuFromCell(
    menu,
    cell
  );

}


function positionMenuFromCell(
  menu,
  cell
) {

  if (
    !menu ||
    !cell
  ) {

    return;

  }


  menu.style.display =
    "block";

  menu.style.visibility =
    "hidden";


  const rect =
    cell.getBoundingClientRect();


  const menuRect =
    menu.getBoundingClientRect();


  let left =
    rect.left +
    rect.width / 2 -
    menuRect.width / 2;


  let top =
    rect.bottom +
    6;


  const margin = 8;


  if (
    left < margin
  ) {

    left = margin;

  }


  if (
    left +
      menuRect.width >
    window.innerWidth -
      margin
  ) {

    left =
      window.innerWidth -
      menuRect.width -
      margin;

  }


  if (
    top +
      menuRect.height >
    window.innerHeight -
      margin
  ) {

    top =
      rect.top -
      menuRect.height -
      6;

  }


  if (
    top < margin
  ) {

    top = margin;

  }


  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

  menu.style.visibility =
    "visible";

}


function closeShiftMenu() {

  const menu =
    $("shiftMenu");

  if (!menu) return;

  menu.style.display =
    "none";

}


function closeLeaveMenu() {

  const menu =
    $("leaveMenu");

  if (!menu) return;

  menu.style.display =
    "none";

  leaveMenuOpen = false;

}


function handleDocumentClick(
  event
) {

  const shiftMenu =
    $("shiftMenu");

  const leaveMenu =
    $("leaveMenu");


  if (
    shiftMenu &&
    shiftMenu.style.display ===
      "block" &&
    !shiftMenu.contains(
      event.target
    )
  ) {

    closeShiftMenu();

  }


  if (
    leaveMenu &&
    leaveMenu.style.display ===
      "block" &&
    !leaveMenu.contains(
      event.target
    )
  ) {

    closeLeaveMenu();

  }

}


/* =========================================================
   勤務保存
   ========================================================= */

async function setWorkShift(
  staffName,
  date,
  shiftName
) {

  if (
    !supabaseClient
  ) {

    return;

  }


  if (
    cloudOperationBusy
  ) {

    return;

  }


  cloudOperationBusy = true;

  setStatus("保存中...");


  try {

    /*
     * ON CONFLICTは使わない。
     *
     * work_shifts側のunique制約が無い環境でも
     * 保存できるように、
     * 既存行を削除してからinsertする。
     */

    const deleteResult =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          date
        );


    if (
      deleteResult.error
    ) {

      throw deleteResult.error;

    }


    const insertResult =
      await supabaseClient
        .from("work_shifts")
        .insert({
          staff_name:
            staffName,

          work_date:
            date,

          shift_name:
            shiftName,

          leave_type:
            null
        });


    if (
      insertResult.error
    ) {

      throw insertResult.error;

    }


    if (
      !appData.shifts[
        staffName
      ]
    ) {

      appData.shifts[
        staffName
      ] = {};

    }


    if (
      !appData.leaves[
        staffName
      ]
    ) {

      appData.leaves[
        staffName
      ] = {};

    }


    appData.shifts[
      staffName
    ][date] =
      shiftName;


    delete appData.leaves[
      staffName
    ][date];


    saveLocal();

    closeShiftMenu();

    renderSchedule();

    setStatus("保存しました");

  } catch (error) {

    console.error(
      "勤務保存エラー",
      error
    );

    alert(
      "勤務を保存できませんでした。\n" +
      error.message
    );

    setStatus(
      "保存失敗",
      "error"
    );

  } finally {

    cloudOperationBusy = false;

  }

}


/* =========================================================
   休暇保存
   ========================================================= */

async function setLeave(
  staffName,
  date,
  leaveName
) {

  if (
    !supabaseClient
  ) {

    return;

  }


  if (
    cloudOperationBusy
  ) {

    return;

  }


  cloudOperationBusy = true;

  setStatus("保存中...");


  try {

    /*
     * ON CONFLICTを使わない。
     */

    const deleteResult =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          date
        );


    if (
      deleteResult.error
    ) {

      throw deleteResult.error;

    }


    const insertResult =
      await supabaseClient
        .from("work_shifts")
        .insert({
          staff_name:
            staffName,

          work_date:
            date,

          shift_name:
            null,

          leave_type:
            leaveName
        });


    if (
      insertResult.error
    ) {

      throw insertResult.error;

    }


    if (
      !appData.leaves[
        staffName
      ]
    ) {

      appData.leaves[
        staffName
      ] = {};

    }


    if (
      !appData.shifts[
        staffName
      ]
    ) {

      appData.shifts[
        staffName
      ] = {};

    }


    appData.leaves[
      staffName
    ][date] =
      leaveName;


    delete appData.shifts[
      staffName
    ][date];


    saveLocal();

    closeLeaveMenu();

    renderSchedule();

    setStatus("休暇を保存しました");

  } catch (error) {

    console.error(
      "休暇保存エラー",
      error
    );

    alert(
      "休暇を保存できませんでした。\n" +
      error.message
    );

    setStatus(
      "保存失敗",
      "error"
    );

  } finally {

    cloudOperationBusy = false;

  }

}


/* =========================================================
   勤務削除
   ========================================================= */

async function clearWorkShift(
  staffName,
  date
) {

  if (
    !supabaseClient
  ) {

    return;

  }


  try {

    const result =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          date
        );


    if (
      result.error
    ) {

      throw result.error;

    }


    if (
      appData.shifts[
        staffName
      ]
    ) {

      delete appData.shifts[
        staffName
      ][date];

    }


    if (
      appData.leaves[
        staffName
      ]
    ) {

      delete appData.leaves[
        staffName
      ][date];

    }


    saveLocal();

    closeShiftMenu();

    closeLeaveMenu();

    renderSchedule();

    setStatus("削除しました");

  } catch (error) {

    console.error(
      error
    );

    alert(
      "削除できませんでした。\n" +
      error.message
    );

  }

}


/* =========================================================
   職員管理
   ========================================================= */

async function saveStaff() {

  const input =
    $("staffNameInput");

  const button =
    $("addStaffButton");

  if (!input) return;


  const name =
    input.value.trim();


  if (!name) {

    alert(
      "職員名を入力してください。"
    );

    return;

  }


  if (name === "明") {

    alert(
      "「明」は職員名には使用できません。"
    );

    return;

  }


  if (
    editingStaffIndex >= 0
  ) {

    const staff =
      appData.staff[
        editingStaffIndex
      ];

    const oldName =
      staff.name;


    if (
      oldName !== name &&
      appData.staff.some(
        item =>
          item.name === name
      )
    ) {

      alert(
        "同じ職員名がすでにあります。"
      );

      return;

    }


    try {

      if (
        supabaseClient
      ) {

        const result =
          await supabaseClient
            .from("staff")
            .update({
              name
            })
            .eq(
              "id",
              staff.id
            );


        if (
          result.error
        ) {

          throw result.error;

        }


        const shiftResult =
          await supabaseClient
            .from("work_shifts")
            .update({
              staff_name:
                name
            })
            .eq(
              "staff_name",
              oldName
            );


        if (
          shiftResult.error
        ) {

          throw shiftResult.error;

        }

      }


      appData.staff[
        editingStaffIndex
      ].name =
        name;


      if (
        appData.shifts[
          oldName
        ]
      ) {

        appData.shifts[
          name
        ] =
          appData.shifts[
            oldName
          ];

        delete appData.shifts[
          oldName
        ];

      }


      if (
        appData.leaves[
          oldName
        ]
      ) {

        appData.leaves[
          name
        ] =
          appData.leaves[
            oldName
          ];

        delete appData.leaves[
          oldName
        ];

      }


      resetStaffForm();

      saveLocal();

      renderAll();

      setStatus("職員を更新しました");

    } catch (error) {

      console.error(error);

      alert(
        "職員を更新できませんでした。\n" +
        error.message
      );

    }


    return;

  }


  if (
    appData.staff.some(
      staff =>
        staff.name === name
    )
  ) {

    alert(
      "同じ職員名がすでにあります。"
    );

    return;

  }


  try {

    let newStaff = {
      name,
      sort_order:
        appData.staff.length
    };


    if (
      supabaseClient
    ) {

      const result =
        await supabaseClient
          .from("staff")
          .insert(
            newStaff
          )
          .select()
          .single();


      if (
        result.error
      ) {

        throw result.error;

      }


      newStaff =
        result.data;

    }


    appData.staff.push(
      newStaff
    );

    saveLocal();

    resetStaffForm();

    renderAll();

    setStatus("職員を追加しました");

  } catch (error) {

    console.error(error);

    alert(
      "職員を追加できませんでした。\n" +
      error.message
    );

  }

}


function editStaff(index) {

  const staff =
    appData.staff[index];

  if (!staff) return;


  editingStaffIndex =
    index;


  $("staffNameInput").value =
    staff.name;


  $("addStaffButton").textContent =
    "職員を更新";


  $("staffNameInput").focus();

}


function resetStaffForm() {

  editingStaffIndex =
    -1;

  $("staffNameInput").value =
    "";

  $("addStaffButton").textContent =
    "職員を追加";

}


/* =========================================================
   職員並び替え
   ========================================================= */

async function moveStaff(
  index,
  direction
) {

  const newIndex =
    index + direction;


  if (
    newIndex < 0 ||
    newIndex >= appData.staff.length
  ) {

    return;

  }


  const current =
    appData.staff[index];

  const target =
    appData.staff[newIndex];


  [
    appData.staff[index],
    appData.staff[newIndex]
  ] = [
    appData.staff[newIndex],
    appData.staff[index]
  ];


  appData.staff.forEach(
    (staff, i) => {

      staff.sort_order = i;

    }
  );


  saveLocal();

  renderStaffList();

  renderSchedule();


  if (!supabaseClient) {

    return;

  }


  try {

    const currentResult =
      await supabaseClient
        .from("staff")
        .update({
          sort_order:
            current.sort_order
        })
        .eq(
          "id",
          current.id
        );


    if (
      currentResult.error
    ) {

      throw currentResult.error;

    }


    const targetResult =
      await supabaseClient
        .from("staff")
        .update({
          sort_order:
            target.sort_order
        })
        .eq(
          "id",
          target.id
        );


    if (
      targetResult.error
    ) {

      throw targetResult.error;

    }


    setStatus("並び順を保存しました");

  } catch (error) {

    console.error(
      "並び替え保存エラー",
      error
    );

    alert(
      "並び順を保存できませんでした。\n" +
      error.message
    );

    await loadAllFromSupabase();

  }

}


/* =========================================================
   職員削除
   ========================================================= */

async function deleteStaff(
  index
) {

  const staff =
    appData.staff[index];

  if (!staff) return;


  if (
    !confirm(
      `${staff.name} を削除しますか？\n\n勤務データも削除されます。`
    )
  ) {

    return;

  }


  try {

    if (
      supabaseClient
    ) {

      const shiftResult =
        await supabaseClient
          .from("work_shifts")
          .delete()
          .eq(
            "staff_name",
            staff.name
          );


      if (
        shiftResult.error
      ) {

        throw shiftResult.error;

      }


      const staffResult =
        await supabaseClient
          .from("staff")
          .delete()
          .eq(
            "id",
            staff.id
          );


      if (
        staffResult.error
      ) {

        throw staffResult.error;

      }

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


    appData.staff.forEach(
      (item, i) => {

        item.sort_order = i;

      }
    );


    saveLocal();

    renderAll();

    setStatus("職員を削除しました");

  } catch (error) {

    console.error(error);

    alert(
      "職員を削除できませんでした。\n" +
      error.message
    );

  }

}


/* =========================================================
   職員一覧描画
   ========================================================= */

function renderStaffList() {

  const list =
    $("staffList");

  const count =
    $("staffCount");

  if (!list) return;


  if (count) {

    count.textContent =
      `職員数：${appData.staff.length}人`;

  }


  if (
    appData.staff.length === 0
  ) {

    list.innerHTML =
      `<div class="empty-message">職員が登録されていません。</div>`;

    return;

  }


  list.innerHTML =
    appData.staff
      .map(
        (staff, index) => `
          <div class="list-item staff-list-item">

            <div class="list-item-main">
              <div class="list-item-title">
                ${escapeHtml(staff.name)}
              </div>
            </div>

            <div class="list-item-actions">

              <button
                type="button"
                class="sort-button"
                ${index === 0 ? "disabled" : ""}
                data-staff-up="${index}"
              >
                ↑
              </button>

              <button
                type="button"
                class="sort-button"
                ${
                  index ===
                  appData.staff.length - 1
                    ? "disabled"
                    : ""
                }
                data-staff-down="${index}"
              >
                ↓
              </button>

              <button
                type="button"
                class="edit-button"
                data-staff-edit="${index}"
              >
                編集
              </button>

              <button
                type="button"
                class="delete-button"
                data-staff-delete="${index}"
              >
                削除
              </button>

            </div>

          </div>
        `
      )
      .join("");


  $$("[data-staff-up]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          moveStaff(
            Number(
              button.dataset.staffUp
            ),
            -1
          );

        }
      );

    });


  $$("[data-staff-down]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          moveStaff(
            Number(
              button.dataset.staffDown
            ),
            1
          );

        }
      );

    });


  $$("[data-staff-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          editStaff(
            Number(
              button.dataset.staffEdit
            )
          );

        }
      );

    });


  $$("[data-staff-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteStaff(
            Number(
              button.dataset.staffDelete
            )
          );

        }
      );

    });

}


/* =========================================================
   勤務形態
   ========================================================= */

async function saveShiftType() {

  const name =
    $("shiftNameInput")
      ?.value
      .trim();

  const start =
    $("shiftStartInput")
      ?.value || "";

  const end =
    $("shiftEndInput")
      ?.value || "";

  const breakTime =
    $("shiftBreakInput")
      ?.value
      .trim() || "";


  if (!name) {

    alert(
      "勤務形態名を入力してください。"
    );

    return;

  }


  if (
    editingShiftIndex >= 0
  ) {

    const shift =
      appData.shiftTypes[
        editingShiftIndex
      ];

    const oldName =
      shift.name;


    if (
      oldName !== name &&
      appData.shiftTypes.some(
        item =>
          item.name === name
      )
    ) {

      alert(
        "同じ勤務形態名があります。"
      );

      return;

    }


    try {

      if (
        supabaseClient
      ) {

        const result =
          await supabaseClient
            .from("shift_types")
            .update({
              name,
              start_time:
                start || null,
              end_time:
                end || null,
              break_time:
                breakTime
            })
            .eq(
              "id",
              shift.id
            );


        if (
          result.error
        ) {

          throw result.error;

        }


        if (
          oldName !== name
        ) {

          const workResult =
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


            if (
              workResult.error
            ) {

              throw workResult.error;

            }

        }

      }


      appData.shiftTypes[
        editingShiftIndex
      ] = {
        ...shift,
        name,
        start_time:
          start || null,
        end_time:
          end || null,
        break_time:
          breakTime
      };


      if (
        oldName !== name
      ) {

        Object.keys(
          appData.shifts
        )
        .forEach(
          staff => {

            Object.keys(
              appData.shifts[
                staff
              ] || {}
            )
            .forEach(
              date => {

                if (
                  appData.shifts[
                    staff
                  ][date] ===
                  oldName
                ) {

                  appData.shifts[
                    staff
                  ][date] =
                    name;

                }

              }
            );

          }
        );

      }


      resetShiftForm();

      saveLocal();

      renderAll();

      setStatus(
        "勤務形態を更新しました"
      );

    } catch (error) {

      console.error(error);

      alert(
        "勤務形態を更新できませんでした。\n" +
        error.message
      );

    }

    return;

  }


  try {

    let shift = {
      name,
      start_time:
        start || null,
      end_time:
        end || null,
      break_time:
        breakTime
    };


    if (
      supabaseClient
    ) {

      const result =
        await supabaseClient
          .from("shift_types")
          .insert(
            shift
          )
          .select()
          .single();


      if (
        result.error
      ) {

        throw result.error;

      }


      shift =
        result.data;

    }


    appData.shiftTypes.push(
      shift
    );

    saveLocal();

    resetShiftForm();

    renderAll();

    setStatus(
      "勤務形態を追加しました"
    );

  } catch (error) {

    console.error(error);

    alert(
      "勤務形態を追加できませんでした。\n" +
      error.message
    );

  }

}


function editShift(index) {

  const shift =
    appData.shiftTypes[index];

  if (!shift) return;


  editingShiftIndex =
    index;


  $("shiftNameInput").value =
    shift.name || "";

  $("shiftStartInput").value =
    shift.start_time || "";

  $("shiftEndInput").value =
    shift.end_time || "";

  $("shiftBreakInput").value =
    shift.break_time || "";


  $("addShiftButton").textContent =
    "勤務形態を更新";


  $("shiftNameInput").focus();

}


function resetShiftForm() {

  editingShiftIndex =
    -1;

  $("shiftNameInput").value =
    "";

  $("shiftStartInput").value =
    "";

  $("shiftEndInput").value =
    "";

  $("shiftBreakInput").value =
    "";

  $("addShiftButton").textContent =
    "勤務形態を追加";

}


async function deleteShiftType(
  index
) {

  const shift =
    appData.shiftTypes[index];

  if (!shift) return;


  try {

    if (
      supabaseClient
    ) {

      const check =
        await supabaseClient
          .from("work_shifts")
          .select("id")
          .eq(
            "shift_name",
            shift.name
          )
          .limit(1);


      if (
        check.error
      ) {

        throw check.error;

      }


      if (
        (check.data || []).length
      ) {

        alert(
          "この勤務形態は勤務表で使用されているため削除できません。"
        );

        return;

      }


      const result =
        await supabaseClient
          .from("shift_types")
          .delete()
          .eq(
            "id",
            shift.id
          );


      if (
        result.error
      ) {

        throw result.error;

      }

    }


    appData.shiftTypes.splice(
      index,
      1
    );

    saveLocal();

    renderAll();

  } catch (error) {

    console.error(error);

    alert(
      "勤務形態を削除できませんでした。\n" +
      error.message
    );

  }

}


function renderShiftList() {

  const list =
    $("shiftList");

  if (!list) return;


  if (
    appData.shiftTypes.length === 0
  ) {

    list.innerHTML =
      `<div class="empty-message">勤務形態が登録されていません。</div>`;

    return;

  }


  list.innerHTML =
    appData.shiftTypes
      .map(
        (shift, index) => `

          <div class="list-item">

            <div class="list-item-main">

              <div class="list-item-title">
                ${escapeHtml(shift.name)}
              </div>

              <div class="list-item-sub">
                ${
                  shift.start_time ||
                  "--:--"
                }
                ～
                ${
                  shift.end_time ||
                  "--:--"
                }
                ${
                  shift.break_time
                    ? ` / 休憩 ${escapeHtml(shift.break_time)}`
                    : ""
                }
              </div>

            </div>

            <div class="list-item-actions">

              <button
                type="button"
                class="edit-button"
                data-shift-edit="${index}"
              >
                編集
              </button>

              <button
                type="button"
                class="delete-button"
                data-shift-delete="${index}"
              >
                削除
              </button>

            </div>

          </div>

        `
      )
      .join("");


  $$("[data-shift-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          editShift(
            Number(
              button.dataset.shiftEdit
            )
          );

        }
      );

    });


  $$("[data-shift-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteShiftType(
            Number(
              button.dataset.shiftDelete
            )
          );

        }
      );

    });

}


/* =========================================================
   休暇種類
   ========================================================= */

async function saveLeaveType() {

  const name =
    $("leaveTypeNameInput")
      ?.value
      .trim();

  const color =
    $("leaveTypeColorInput")
      ?.value ||
      "#d9f2df";


  if (!name) {

    alert(
      "休暇種類名を入力してください。"
    );

    return;

  }


  if (
    editingLeaveTypeId !== null
  ) {

    const old =
      appData.leaveTypes.find(
        item =>
          Number(item.id) ===
          Number(editingLeaveTypeId)
      );


    if (!old) {

      resetLeaveTypeForm();

      return;

    }


    if (
      old.name !== name &&
      appData.leaveTypes.some(
        item =>
          item.name === name &&
          Number(item.id) !==
            Number(old.id)
      )
    ) {

      alert(
        "同じ休暇種類名があります。"
      );

      return;

    }


    try {

      if (
        supabaseClient
      ) {

        const result =
          await supabaseClient
            .from("leave_types")
            .update({
              name,
              color
            })
            .eq(
              "id",
              old.id
            );


        if (
          result.error
        ) {

          throw result.error;

        }


        if (
          old.name !== name
        ) {

          const workResult =
            await supabaseClient
              .from("work_shifts")
              .update({
                leave_type:
                  name
              })
              .eq(
                "leave_type",
                old.name
              );


          if (
            workResult.error
          ) {

            throw workResult.error;

          }

        }

      }


      old.name =
        name;

      old.color =
        color;


      if (
        old.name !== name
      ) {

        Object.keys(
          appData.leaves
        )
        .forEach(
          staff => {

            Object.keys(
              appData.leaves[
                staff
              ] || {}
            )
            .forEach(
              date => {

                if (
                  appData.leaves[
                    staff
                  ][date] ===
                  old.name
                ) {

                  appData.leaves[
                    staff
                  ][date] =
                    name;

                }

              }
            );

          }
        );

      }


      resetLeaveTypeForm();

      saveLocal();

      renderAll();

      setStatus(
        "休暇種類を更新しました"
      );

    } catch (error) {

      console.error(error);

      alert(
        "休暇種類を更新できませんでした。\n" +
        error.message
      );

    }

    return;

  }


  try {

    let leaveType = {
      name,
      color
    };


    if (
      supabaseClient
    ) {

      const result =
        await supabaseClient
          .from("leave_types")
          .insert(
            leaveType
          )
          .select()
          .single();


      if (
        result.error
      ) {

        throw result.error;

      }


      leaveType =
        result.data;

    }


    appData.leaveTypes.push(
      leaveType
    );

    saveLocal();

    resetLeaveTypeForm();

    renderAll();

    setStatus(
      "休暇種類を追加しました"
    );

  } catch (error) {

    console.error(error);

    alert(
      "休暇種類を追加できませんでした。\n" +
      error.message
    );

  }

}


function editLeaveType(id) {

  const leave =
    appData.leaveTypes.find(
      item =>
        Number(item.id) ===
        Number(id)
    );

  if (!leave) return;


  editingLeaveTypeId =
    Number(id);


  $("leaveTypeNameInput").value =
    leave.name || "";

  $("leaveTypeColorInput").value =
    leave.color ||
    "#d9f2df";


  $("addLeaveTypeButton").textContent =
    "休暇種類を更新";


  $("leaveTypeNameInput").focus();

}


function resetLeaveTypeForm() {

  editingLeaveTypeId =
    null;

  $("leaveTypeNameInput").value =
    "";

  $("leaveTypeColorInput").value =
    "#d9f2df";

  $("addLeaveTypeButton").textContent =
    "休暇種類を追加";

}


async function deleteLeaveType(
  id
) {

  const leave =
    appData.leaveTypes.find(
      item =>
        Number(item.id) ===
        Number(id)
    );

  if (!leave) return;


  try {

    if (
      supabaseClient
    ) {

      const check =
        await supabaseClient
          .from("work_shifts")
          .select("id")
          .eq(
            "leave_type",
            leave.name
          )
          .limit(1);


      if (
        check.error
      ) {

        throw check.error;

      }


      if (
        (check.data || []).length
      ) {

        alert(
          "この休暇種類は勤務表で使用されているため削除できません。"
        );

        return;

      }


      const result =
        await supabaseClient
          .from("leave_types")
          .delete()
          .eq(
            "id",
            leave.id
          );


      if (
        result.error
      ) {

        throw result.error;

      }

    }


    appData.leaveTypes =
      appData.leaveTypes.filter(
        item =>
          Number(item.id) !==
          Number(id)
      );


    saveLocal();

    renderAll();

    setStatus(
      "休暇種類を削除しました"
    );

  } catch (error) {

    console.error(error);

    alert(
      "休暇種類を削除できませんでした。\n" +
      error.message
    );

  }

}


function renderLeaveTypeList() {

  const list =
    $("leaveTypeList");

  if (!list) return;


  if (
    appData.leaveTypes.length === 0
  ) {

    list.innerHTML =
      `<div class="empty-message">休暇種類が登録されていません。</div>`;

    return;

  }


  list.innerHTML =
    appData.leaveTypes
      .map(
        leave => `

          <div class="list-item">

            <div class="list-item-main leave-type-main">

              <span
                class="leave-color-swatch"
                style="background:${escapeHtml(
                  leave.color ||
                  "#d9f2df"
                )};"
              ></span>

              <div class="list-item-title">
                ${escapeHtml(leave.name)}
              </div>

            </div>

            <div class="list-item-actions">

              <button
                type="button"
                class="edit-button"
                data-leave-edit="${leave.id}"
              >
                編集
              </button>

              <button
                type="button"
                class="delete-button"
                data-leave-delete="${leave.id}"
              >
                削除
              </button>

            </div>

          </div>

        `
      )
      .join("");


  $$("[data-leave-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          editLeaveType(
            Number(
              button.dataset.leaveEdit
            )
          );

        }
      );

    });


  $$("[data-leave-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteLeaveType(
            Number(
              button.dataset.leaveDelete
            )
          );

        }
      );

    });

}


function getLeaveType(name) {

  return appData.leaveTypes.find(
    item =>
      item.name === name
  );

}


/* =========================================================
   休業日
   ========================================================= */

async function saveCompanyHoliday() {

  const name =
    $("companyHolidayName")
      ?.value
      .trim();

  const start =
    $("companyHolidayStart")
      ?.value;

  const end =
    $("companyHolidayEnd")
      ?.value ||
      start;


  if (!name) {

    alert(
      "休業日名を入力してください。"
    );

    return;

  }


  if (!start) {

    alert(
      "開始日を入力してください。"
    );

    return;

  }


  try {

    if (
      editingHolidayId !== null
    ) {

      if (
        supabaseClient
      ) {

        const result =
          await supabaseClient
            .from("company_holidays")
            .update({
              name,
              start_date:
                start,
              end_date:
                end
            })
            .eq(
              "id",
              editingHolidayId
            );


        if (
          result.error
        ) {

          throw result.error;

        }

      }


      const item =
        appData.companyHolidays.find(
          holiday =>
            Number(holiday.id) ===
            Number(
              editingHolidayId
            )
        );


      if (item) {

        item.name =
          name;

        item.start_date =
          start;

        item.end_date =
          end;

      }


      resetHolidayForm();

      saveLocal();

      renderAll();

      return;

    }


    let holiday = {
      name,
      start_date:
        start,
      end_date:
        end
    };


    if (
      supabaseClient
    ) {

      const result =
        await supabaseClient
          .from("company_holidays")
          .insert(
            holiday
          )
          .select()
          .single();


      if (
        result.error
      ) {

        throw result.error;

      }


      holiday =
        result.data;

    }


    appData.companyHolidays.push(
      holiday
    );

    saveLocal();

    resetHolidayForm();

    renderAll();

    setStatus(
      "休業日を追加しました"
    );

  } catch (error) {

    console.error(error);

    alert(
      "休業日を保存できませんでした。\n" +
      error.message
    );

  }

}


function editCompanyHoliday(id) {

  const item =
    appData.companyHolidays.find(
      holiday =>
        Number(holiday.id) ===
        Number(id)
    );

  if (!item) return;


  editingHolidayId =
    Number(id);


  $("companyHolidayName").value =
    item.name || "";

  $("companyHolidayStart").value =
    item.start_date || "";

  $("companyHolidayEnd").value =
    item.end_date ||
    item.start_date ||
    "";


  $("addCompanyHolidayButton").textContent =
    "休業日を更新";


  $("companyHolidayName").focus();

}


function resetHolidayForm() {

  editingHolidayId =
    null;

  $("companyHolidayName").value =
    "";

  $("companyHolidayStart").value =
    "";

  $("companyHolidayEnd").value =
    "";

  $("addCompanyHolidayButton").textContent =
    "休業日を追加";

}


async function deleteCompanyHoliday(
  id
) {

  if (
    !confirm(
      "この休業日を削除しますか？"
    )
  ) {

    return;

  }


  try {

    if (
      supabaseClient
    ) {

      const result =
        await supabaseClient
          .from("company_holidays")
          .delete()
          .eq(
            "id",
            id
          );


      if (
        result.error
      ) {

        throw result.error;

      }

    }


    appData.companyHolidays =
      appData.companyHolidays.filter(
        holiday =>
          Number(holiday.id) !==
          Number(id)
      );


    saveLocal();

    renderAll();

  } catch (error) {

    console.error(error);

    alert(
      "休業日を削除できませんでした。\n" +
      error.message
    );

  }

}


function renderCompanyHolidayList() {

  const list =
    $("companyHolidayList");

  if (!list) return;


  if (
    appData.companyHolidays.length === 0
  ) {

    list.innerHTML =
      `<div class="empty-message">休業日が登録されていません。</div>`;

    return;

  }


  list.innerHTML =
    appData.companyHolidays
      .map(
        holiday => `

          <div class="list-item">

            <div class="list-item-main">

              <div class="list-item-title">
                ${escapeHtml(holiday.name)}
              </div>

              <div class="list-item-sub">
                ${formatDateJapanese(
                  holiday.start_date
                )}
                ～
                ${formatDateJapanese(
                  holiday.end_date ||
                  holiday.start_date
                )}
              </div>

            </div>

            <div class="list-item-actions">

              <button
                type="button"
                class="edit-button"
                data-holiday-edit="${holiday.id}"
              >
                編集
              </button>

              <button
                type="button"
                class="delete-button"
                data-holiday-delete="${holiday.id}"
              >
                削除
              </button>

            </div>

          </div>

        `
      )
      .join("");


  $$("[data-holiday-edit]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          editCompanyHoliday(
            Number(
              button.dataset.holidayEdit
            )
          );

        }
      );

    });


  $$("[data-holiday-delete]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteCompanyHoliday(
            Number(
              button.dataset.holidayDelete
            )
          );

        }
      );

    });

}


/* =========================================================
   明の時間
   ========================================================= */

function renderAkeTime() {

  if (
    $("akeStartInput")
  ) {

    $("akeStartInput").value =
      appData.akeTime.start;

  }


  if (
    $("akeEndInput")
  ) {

    $("akeEndInput").value =
      appData.akeTime.end;

  }

}


async function upsertAppSetting(
  name,
  value
) {

  if (
    !supabaseClient
  ) {

    return;

  }


  const existing =
    await supabaseClient
      .from("app_settings")
      .select(
        "setting_name"
      )
      .eq(
        "setting_name",
        name
      )
      .maybeSingle();


  if (
    existing.error
  ) {

    throw existing.error;

  }


  if (
    existing.data
  ) {

    const result =
      await supabaseClient
        .from("app_settings")
        .update({
          setting_value:
            value
        })
        .eq(
          "setting_name",
          name
        );


    if (
      result.error
    ) {

      throw result.error;

    }

  } else {

    const result =
      await supabaseClient
        .from("app_settings")
        .insert({
          setting_name:
            name,

          setting_value:
            value
        });


    if (
      result.error
    ) {

      throw result.error;

    }

  }

}


async function saveAkeTime() {

  const start =
    $("akeStartInput")
      ?.value ||
      "05:30";

  const end =
    $("akeEndInput")
      ?.value ||
      "11:15";


  try {

    await upsertAppSetting(
      "ake_start",
      start
    );

    await upsertAppSetting(
      "ake_end",
      end
    );


    appData.akeTime = {
      start,
      end
    };


    saveLocal();

    renderSchedule();

    setStatus(
      "「明」の時間を保存しました"
    );

  } catch (error) {

    console.error(error);

    alert(
      "「明」の時間を保存できませんでした。\n" +
      error.message
    );

  }

}


/* =========================================================
   今月削除
   ========================================================= */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  const start =
    `${year}-${pad2(month + 1)}-01`;

  const endDate =
    new Date(
      year,
      month + 1,
      0
    );

  const end =
    dateKey(endDate);


  if (
    !confirm(
      `${year}年${month + 1}月の勤務をすべて削除しますか？`
    )
  ) {

    return;

  }


  try {

    if (
      supabaseClient
    ) {

      const result =
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


      if (
        result.error
      ) {

        throw result.error;

      }

    }


    for (
      const staff of appData.staff
    ) {

      const name =
        staff.name;


      if (
        appData.shifts[name]
      ) {

        Object.keys(
          appData.shifts[name]
        )
        .forEach(
          key => {

            if (
              key >= start &&
              key <= end
            ) {

              delete appData.shifts[
                name
              ][key];

            }

          }
        );

      }


      if (
        appData.leaves[name]
      ) {

        Object.keys(
          appData.leaves[name]
        )
        .forEach(
          key => {

            if (
              key >= start &&
              key <= end
            ) {

              delete appData.leaves[
                name
              ][key];

            }

          }
        );

      }

    }


    saveLocal();

    renderSchedule();

    setStatus(
      "今月の勤務を削除しました"
    );

  } catch (error) {

    console.error(error);

    alert(
      "今月の勤務を削除できませんでした。\n" +
      error.message
    );

  }

}


/* =========================================================
   年度削除
   ========================================================= */

async function deleteFiscalYear() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  let fiscalStartYear =
    year;

  if (
    month < 3
  ) {

    fiscalStartYear--;

  }


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


  try {

    if (
      supabaseClient
    ) {

      const result =
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


      if (
        result.error
      ) {

        throw result.error;

      }

    }


    appData.staff.forEach(
      staff => {

        const name =
          staff.name;


        if (
          appData.shifts[name]
        ) {

          Object.keys(
            appData.shifts[name]
          )
          .forEach(
            key => {

              if (
                key >= start &&
                key <= end
              ) {

                delete appData.shifts[
                  name
                ][key];

              }

            }
          );

        }


        if (
          appData.leaves[name]
        ) {

          Object.keys(
            appData.leaves[name]
          )
          .forEach(
            key => {

              if (
                key >= start &&
                key <= end
              ) {

                delete appData.leaves[
                  name
                ][key];

              }

            }
          );

        }

      }
    );


    saveLocal();

    renderSchedule();

    setStatus(
      "年度の勤務を削除しました"
    );

  } catch (error) {

    console.error(error);

    alert(
      "年度の勤務を削除できませんでした。\n" +
      error.message
    );

  }

}


/* =========================================================
   カレンダー
   ========================================================= */

function openCalendarModal(
  staffName
) {

  selectedCalendarStaff =
    staffName;


  const modal =
    $("calendarConfirm");

  const title =
    $("calendarConfirmTitle");

  const text =
    $("calendarConfirmText");


  if (!modal) return;


  if (title) {

    title.textContent =
      `${staffName} のカレンダー`;

  }


  if (text) {

    text.textContent =
      "iPhoneのカレンダーに登録しますか？";

  }


  modal.classList.add(
    "show"
  );

}


function closeCalendarModal() {

  const modal =
    $("calendarConfirm");

  if (!modal) return;

  modal.classList.remove(
    "show"
  );

  selectedCalendarStaff =
    null;

}


/*
 * webcal登録
 *
 * staffテーブルのcalendar_tokenを使って
 * カレンダーフィードURLを作る。
 */
function registerWebcal() {

  if (
    !selectedCalendarStaff
  ) {

    closeCalendarModal();

    return;

  }


  const staff =
    appData.staff.find(
      item =>
        item.name ===
        selectedCalendarStaff
    );


  if (!staff) {

    alert(
      "職員情報が見つかりません。"
    );

    return;

  }


  if (
    !staff.calendar_token
  ) {

    alert(
      "この職員にはカレンダー登録用トークンがありません。"
    );

    return;

  }


  const httpsUrl =
    SUPABASE_URL +
    CALENDAR_FEED_PATH +
    "?token=" +
    encodeURIComponent(
      staff.calendar_token
    );


  const webcalUrl =
    httpsUrl.replace(
      /^https?:\/\//,
      "webcal://"
    );


  /*
   * iPhoneではwebcal://を開くことで
   * カレンダー照会登録画面へ進める。
   */
  window.location.href =
    webcalUrl;


  closeCalendarModal();

}


/* =========================================================
   フォームリセット
   ========================================================= */

$("companyHolidayStart")
  ?.addEventListener(
    "change",
    () => {

      const end =
        $("companyHolidayEnd");

      if (
        end &&
        !end.value
      ) {

        end.value =
          $("companyHolidayStart").value;

      }

    }
  );


/* =========================================================
   画面外クリック・リサイズ
   ========================================================= */

window.addEventListener(
  "resize",
  () => {

    closeShiftMenu();

    closeLeaveMenu();

  }
);


window.addEventListener(
  "scroll",
  () => {

    closeShiftMenu();

    closeLeaveMenu();

  },
  true
);


/* =========================================================
   初期ページ
   ========================================================= */

showPage("schedule");
