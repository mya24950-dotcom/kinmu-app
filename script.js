"use strict";

/* =========================================================
   Supabase設定
========================================================= */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

const LOCAL_STORAGE_KEY =
  "workScheduleAppData";


/* =========================================================
   Supabase
========================================================= */

let supabaseClient = null;
let realtimeChannel = null;
let realtimeReloadTimer = null;
let autoSyncTimer = null;


/* =========================================================
   アプリデータ
========================================================= */

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


/* =========================================================
   状態
========================================================= */

let currentDate = new Date();
currentDate.setDate(1);

let editingStaffIndex = -1;
let editingShiftIndex = -1;
let editingHolidayId = null;
let editingLeaveTypeId = null;

let selectedCell = null;
let selectedCalendarStaff = null;

let publicHolidays = {};

let leaveMenuOpen = false;

let cloudOperationBusy = false;


/* =========================================================
   DOM
========================================================= */

function $(id) {
  return document.getElementById(id);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}


/* =========================================================
   初期化
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async function () {

    try {

      loadLocalData();

      initializeSupabase();

      bindEvents();

      renderAll();

      await loadPublicHolidays();

      await loadAllFromSupabase();

      setupRealtime();

      startAutoSync();

      setStatus(
        "オンライン",
        "success"
      );

    } catch (error) {

      console.error(
        "初期化エラー:",
        error
      );

      renderAll();

      setStatus(
        "ローカルモード",
        "error"
      );

    }

  }
);


/* =========================================================
   Supabase初期化
========================================================= */

function initializeSupabase() {

  if (
    window.supabase &&
    typeof window.supabase.createClient ===
      "function"
  ) {

    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );

  } else {

    console.error(
      "Supabaseライブラリがありません"
    );

  }

}


/* =========================================================
   イベント登録
========================================================= */

function bindEvents() {

  /* ページ */

  $$(".nav-button").forEach(
    button => {

      button.addEventListener(
        "click",
        function () {

          showPage(
            button.dataset.page
          );

        }
      );

    }
  );


  /* 月移動 */

  $("prevMonth")?.addEventListener(
    "click",
    function () {

      currentDate.setMonth(
        currentDate.getMonth() - 1
      );

      renderSchedule();

    }
  );


  $("nextMonth")?.addEventListener(
    "click",
    function () {

      currentDate.setMonth(
        currentDate.getMonth() + 1
      );

      renderSchedule();

    }
  );


  /* 職員 */

  $("addStaffButton")?.addEventListener(
    "click",
    addOrUpdateStaff
  );


  /* 勤務形態 */

  $("addShiftButton")?.addEventListener(
    "click",
    addOrUpdateShift
  );


  /* 休業日 */

  $("addCompanyHolidayButton")?.addEventListener(
    "click",
    addOrUpdateHoliday
  );


  /* 休暇種類 */

  $("addLeaveTypeButton")?.addEventListener(
    "click",
    addOrUpdateLeaveType
  );


  /* 明 */

  $("saveAkeTimeButton")?.addEventListener(
    "click",
    saveAkeTime
  );


  /* 月削除 */

  $("deleteMonthButton")?.addEventListener(
    "click",
    deleteCurrentMonth
  );


  /* 年度削除 */

  $("deleteFiscalYearButton")?.addEventListener(
    "click",
    deleteFiscalYear
  );


  /* カレンダー */

  $("calendarCancelButton")?.addEventListener(
    "click",
    closeCalendarModal
  );


  $("calendarOKButton")?.addEventListener(
    "click",
    exportCalendarICS
  );


  /* ESC */

  document.addEventListener(
    "keydown",
    function (event) {

      if (event.key === "Escape") {

        closeShiftMenu();

        closeLeaveMenu();

        closeCalendarModal();

      }

    }
  );


  /* 画面復帰 */

  document.addEventListener(
    "visibilitychange",
    function () {

      if (
        document.visibilityState ===
        "visible"
      ) {

        loadAllFromSupabase(true);

      }

    }
  );

}


/* =========================================================
   ページ切替
========================================================= */

function showPage(pageName) {

  const pages = {
    schedule: $("schedulePage"),
    staff: $("staffPage"),
    shift: $("shiftPage"),
    holiday: $("holidayPage"),
    leaveType: $("leaveTypePage")
  };


  Object.keys(pages).forEach(
    key => {

      const page = pages[key];

      if (!page) return;

      page.style.display =
        key === pageName
          ? ""
          : "none";

    }
  );


  $$(".nav-button").forEach(
    button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
          pageName
      );

    }
  );

}


/* =========================================================
   LocalStorage
========================================================= */

function saveLocalData() {

  try {

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(appData)
    );

  } catch (error) {

    console.error(
      "LocalStorage保存エラー:",
      error
    );

  }

}


function loadLocalData() {

  try {

    const saved =
      localStorage.getItem(
        LOCAL_STORAGE_KEY
      );

    if (!saved) return;

    const data =
      JSON.parse(saved);

    if (!data) return;


    appData.staff =
      Array.isArray(data.staff)
        ? data.staff
        : [];


    appData.shiftTypes =
      Array.isArray(data.shiftTypes)
        ? data.shiftTypes
        : [];


    appData.leaveTypes =
      Array.isArray(data.leaveTypes)
        ? data.leaveTypes
        : [];


    appData.companyHolidays =
      Array.isArray(
        data.companyHolidays
      )
        ? data.companyHolidays
        : [];


    appData.shifts =
      data.shifts &&
      typeof data.shifts ===
        "object"
        ? data.shifts
        : {};


    appData.leaves =
      data.leaves &&
      typeof data.leaves ===
        "object"
        ? data.leaves
        : {};


    if (
      data.akeTime &&
      typeof data.akeTime ===
        "object"
    ) {

      appData.akeTime = {

        start:
          data.akeTime.start ||
          "05:30",

        end:
          data.akeTime.end ||
          "11:15"

      };

    }

  } catch (error) {

    console.error(
      "LocalStorage読み込みエラー:",
      error
    );

  }

}


/* =========================================================
   Supabase全取得
========================================================= */

async function loadAllFromSupabase(
  silent = false
) {

  if (!supabaseClient) {
    return false;
  }


  const results =
    await Promise.allSettled([

      loadStaffFromSupabase(),

      loadShiftTypesFromSupabase(),

      loadWorkShiftsFromSupabase(),

      loadCompanyHolidaysFromSupabase(),

      loadLeaveTypesFromSupabase(),

      loadSettingsFromSupabase()

    ]);


  const failed =
    results.filter(
      r =>
        r.status ===
        "rejected"
    );


  if (failed.length > 0) {

    console.error(
      "Supabase取得失敗:",
      failed
    );

    if (!silent) {

      setStatus(
        "一部取得失敗",
        "error"
      );

    }

  }


  saveLocalData();

  renderAll();


  return failed.length === 0;

}


/* =========================================================
   職員取得
========================================================= */

async function loadStaffFromSupabase() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("staff")
      .select(
        "id,name,created_at,sort_order,calendar_token"
      );


  if (error) {

    console.error(
      "staff取得エラー:",
      error
    );

    throw error;

  }


  appData.staff =
    (data || [])
      .filter(
        staff =>
          staff.name &&
          staff.name !== "明"
      )
      .sort(
        (a, b) => {

          const aSort =
            a.sort_order ??
            999999;

          const bSort =
            b.sort_order ??
            999999;

          if (
            aSort !==
            bSort
          ) {

            return (
              aSort -
              bSort
            );

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

}


/* =========================================================
   勤務形態取得
========================================================= */

async function loadShiftTypesFromSupabase() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("shift_types")
      .select(
        "id,name,created_at,start_time,end_time,break_time"
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      "shift_types取得エラー:",
      error
    );

    throw error;

  }


  appData.shiftTypes =
    data || [];

}


/* =========================================================
   勤務取得
========================================================= */

async function loadWorkShiftsFromSupabase() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("work_shifts")
      .select(
        "id,staff_name,work_date,shift_name,leave_type"
      );


  if (error) {

    console.error(
      "work_shifts取得エラー:",
      error
    );

    throw error;

  }


  const shifts = {};
  const leaves = {};


  (data || []).forEach(
    row => {

      if (
        !row.staff_name ||
        !row.work_date
      ) {

        return;

      }


      if (
        row.leave_type &&
        String(
          row.leave_type
        ).trim() !== ""
      ) {

        if (
          !leaves[
            row.staff_name
          ]
        ) {

          leaves[
            row.staff_name
          ] = {};

        }


        leaves[
          row.staff_name
        ][
          row.work_date
        ] =
          row.leave_type;


      } else if (
        row.shift_name &&
        String(
          row.shift_name
        ).trim() !== ""
      ) {

        if (
          !shifts[
            row.staff_name
          ]
        ) {

          shifts[
            row.staff_name
          ] = {};

        }


        shifts[
          row.staff_name
        ][
          row.work_date
        ] =
          row.shift_name;

      }

    }
  );


  appData.shifts =
    shifts;

  appData.leaves =
    leaves;

}


/* =========================================================
   休業日取得
========================================================= */

async function loadCompanyHolidaysFromSupabase() {

  const {
    data,
    error
  } =
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


  if (error) {

    console.error(
      "company_holidays取得エラー:",
      error
    );

    throw error;

  }


  appData.companyHolidays =
    data || [];

}


/* =========================================================
   休暇種類取得
========================================================= */

async function loadLeaveTypesFromSupabase() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("leave_types")
      .select(
        "id,name,color,created_at"
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (error) {

    console.error(
      "leave_types取得エラー:",
      error
    );

    throw error;

  }


  appData.leaveTypes =
    data || [];

}


/* =========================================================
   設定取得
========================================================= */

async function loadSettingsFromSupabase() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("app_settings")
      .select(
        "setting_name,setting_value"
      );


  if (error) {

    console.error(
      "app_settings取得エラー:",
      error
    );

    throw error;

  }


  (data || []).forEach(
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

}


/* =========================================================
   Realtime
========================================================= */

function setupRealtime() {

  if (!supabaseClient) {
    return;
  }


  try {

    if (realtimeChannel) {

      supabaseClient
        .removeChannel(
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
          realtimeChanged
        )


        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shift_types"
          },
          realtimeChanged
        )


        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "work_shifts"
          },
          realtimeChanged
        )


        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "company_holidays"
          },
          realtimeChanged
        )


        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "leave_types"
          },
          realtimeChanged
        )


        .subscribe();

  } catch (error) {

    console.error(
      "Realtime設定エラー:",
      error
    );

  }

}


function realtimeChanged() {

  clearTimeout(
    realtimeReloadTimer
  );


  realtimeReloadTimer =
    setTimeout(
      function () {

        loadAllFromSupabase(
          true
        );

      },
      500
    );

}


/* =========================================================
   自動同期
========================================================= */

function startAutoSync() {

  clearInterval(
    autoSyncTimer
  );


  autoSyncTimer =
    setInterval(
      function () {

        if (
          document.visibilityState ===
          "visible"
        ) {

          loadAllFromSupabase(
            true
          );

        }

      },
      10000
    );

}


/* =========================================================
   公開祝日
========================================================= */

async function loadPublicHolidays() {

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
      "祝日取得失敗:",
      error
    );

    publicHolidays = {};

  }

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

  const header =
    $("scheduleHeader");

  const body =
    $("scheduleBody");

  const monthLabel =
    $("currentMonth");


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


  if (monthLabel) {

    monthLabel.textContent =
      `${year}年${month + 1}月`;

  }


  header.innerHTML = "";
  body.innerHTML = "";


  /* 職員 */

  const staffHeader =
    document.createElement(
      "th"
    );

  staffHeader.className =
    "staff-header";

  staffHeader.textContent =
    "職員";

  header.appendChild(
    staffHeader
  );


  /* 日付 */

  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const dateKeys = [];


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
      formatDateKey(
        date
      );


    dateKeys.push(
      dateKey
    );


    const th =
      document.createElement(
        "th"
      );


    th.className =
      "date-header";


    if (
      isPublicHoliday(
        dateKey
      )
    ) {

      th.classList.add(
        "public-holiday"
      );

    }


    if (
      isCompanyHoliday(
        dateKey
      )
    ) {

      th.classList.add(
        "company-holiday"
      );

    }


    const weekday =
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
      `${day}<span>${weekday}</span>`;


    header.appendChild(
      th
    );

  }


  /* 勤務回数 */

  appData.shiftTypes.forEach(
    shift => {

      const th =
        document.createElement(
          "th"
        );

      th.className =
        "count-header";

      th.innerHTML =
        `${escapeHtml(
          shift.name
        )}<br>回数`;

      header.appendChild(
        th
      );

    }
  );


  /* 合計 */

  const totalHeader =
    document.createElement(
      "th"
    );

  totalHeader.className =
    "total-header";

  totalHeader.textContent =
    "合計";

  header.appendChild(
    totalHeader
  );


  /* 職員 */

  appData.staff.forEach(
    (staff, staffIndex) => {

      const tr =
        document.createElement(
          "tr"
        );


      /* 職員名 */

      const staffCell =
        document.createElement(
          "td"
        );

      staffCell.className =
        "staff-name-cell";


      const staffButton =
        document.createElement(
          "button"
        );

      staffButton.type =
        "button";

      staffButton.className =
        "staff-calendar-button";

      staffButton.textContent =
        staff.name;


      staffButton.addEventListener(
        "click",
        function (event) {

          event.stopPropagation();

          openCalendarModal(
            staff.name
          );

        }
      );


      staffCell.appendChild(
        staffButton
      );

      tr.appendChild(
        staffCell
      );


      const countMap = {};

      appData.shiftTypes.forEach(
        shift => {

          countMap[
            shift.name
          ] = 0;

        }
      );


      let total =
        0;


      /* 日付 */

      dateKeys.forEach(
        (dateKey, index) => {

          const td =
            document.createElement(
              "td"
            );

          td.className =
            "schedule-cell";


          if (
            isPublicHoliday(
              dateKey
            )
          ) {

            td.classList.add(
              "holiday-cell"
            );

          }


          if (
            isCompanyHoliday(
              dateKey
            )
          ) {

            td.classList.add(
              "company-holiday-cell"
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


          let display =
            "";


          if (leave) {

            const leaveType =
              findLeaveType(
                leave
              );


            display =
              leave;


            td.classList.add(
              "leave-cell"
            );


            if (
              leaveType &&
              leaveType.color
            ) {

              td.style.backgroundColor =
                leaveType.color;

            }

          } else if (shift) {

            display =
              shift;


            if (
              countMap[
                shift
              ] !== undefined
            ) {

              countMap[
                shift
              ]++;

            }


            total++;

          } else if (
            index > 0
          ) {

            const previousDate =
              dateKeys[
                index - 1
              ];


            const previousShift =
              getShift(
                staff.name,
                previousDate
              );


            if (
              isNightShiftName(
                previousShift
              )
            ) {

              display =
                "明";

              td.classList.add(
                "ake-cell"
              );

            }

          }


          const button =
            document.createElement(
              "button"
            );


          button.type =
            "button";

          button.className =
            "schedule-cell-button";

          button.textContent =
            display;


          button.addEventListener(
            "click",
            function (event) {

              event.stopPropagation();

              /*
               * 休暇メニューが開いている状態で
               * 別セルを押した場合は閉じるだけ
               */
              if (
                leaveMenuOpen
              ) {

                closeLeaveMenu();

                return;

              }


              showShiftMenu(
                td,
                staff.name,
                dateKey
              );

            }
          );


          td.appendChild(
            button
          );


          tr.appendChild(
            td
          );

        }
      );


      /* 回数 */

      appData.shiftTypes.forEach(
        shift => {

          const td =
            document.createElement(
              "td"
            );

          td.className =
            "count-cell";

          td.textContent =
            countMap[
              shift.name
            ] || 0;

          tr.appendChild(
            td
          );

        }
      );


      /* 合計 */

      const totalCell =
        document.createElement(
          "td"
        );

      totalCell.className =
        "total-cell";

      totalCell.textContent =
        total;

      tr.appendChild(
        totalCell
      );


      body.appendChild(
        tr
      );

    }
  );

}


/* =========================================================
   勤務メニュー
   ★ 2列表示
========================================================= */

function showShiftMenu(
  cell,
  staffName,
  dateKey
) {

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


  closeLeaveMenu();


  selectedCell = {
    cell,
    staffName,
    dateKey
  };


  buttons.innerHTML =
    "";


  /* 勤務形態 */

  appData.shiftTypes.forEach(
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
        async function (
          event
        ) {

          event.stopPropagation();


          await setWorkShift(
            selectedCell.staffName,
            selectedCell.dateKey,
            shift.name
          );


          closeShiftMenu();

        }
      );


      buttons.appendChild(
        button
      );

    }
  );


  /* 削除 */

  const deleteButton =
    document.createElement(
      "button"
    );


  deleteButton.type =
    "button";

  deleteButton.className =
    "shift-delete-button";

  deleteButton.textContent =
    "削除";


  deleteButton.addEventListener(
    "click",
    async function (
      event
    ) {

      event.stopPropagation();


      await clearWorkShift(
        selectedCell.staffName,
        selectedCell.dateKey
      );


      closeShiftMenu();

    }
  );


  buttons.appendChild(
    deleteButton
  );


  /* 休暇 */

  if (
    appData.leaveTypes.length >
    0
  ) {

    const leaveButton =
      document.createElement(
        "button"
      );


    leaveButton.type =
      "button";

    leaveButton.className =
      "shift-leave-button";

    leaveButton.textContent =
      "休暇";


    leaveButton.addEventListener(
      "click",
      function (
        event
      ) {

        event.stopPropagation();


        const target =
          selectedCell;


        closeShiftMenu();


        showLeaveMenu(
          target.cell,
          target.staffName,
          target.dateKey
        );

      }
    );


    buttons.appendChild(
      leaveButton
    );

  }


  const title =
    $("shiftMenuTitle");


  if (title) {

    title.textContent =
      `${staffName} ${dateKey}`;

  }


  menu.style.display =
    "block";


  positionMenu(
    menu,
    cell
  );

}


/* =========================================================
   休暇メニュー
   ★ 2列表示
========================================================= */

function showLeaveMenu(
  cell,
  staffName,
  dateKey
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


  leaveMenuOpen =
    true;


  selectedCell = {
    cell,
    staffName,
    dateKey
  };


  buttons.innerHTML =
    "";


  /* 休暇種類 */

  appData.leaveTypes.forEach(
    leaveType => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";

      button.className =
        "leave-choice-button";

      button.textContent =
        leaveType.name;


      if (
        leaveType.color
      ) {

        button.style.backgroundColor =
          leaveType.color;

      }


      button.addEventListener(
        "click",
        async function (
          event
        ) {

          event.stopPropagation();


          const target =
            selectedCell;


          await setLeave(
            target.staffName,
            target.dateKey,
            leaveType.name
          );


          closeLeaveMenu();

        }
      );


      buttons.appendChild(
        button
      );

    }
  );


  /* 休暇解除 */

  const clearButton =
    document.createElement(
      "button"
    );


  clearButton.type =
    "button";

  clearButton.className =
    "leave-clear-button";

  clearButton.textContent =
    "休暇を解除";


  clearButton.addEventListener(
    "click",
    async function (
      event
    ) {

      event.stopPropagation();


      const target =
        selectedCell;


      await clearWorkShift(
        target.staffName,
        target.dateKey
      );


      closeLeaveMenu();

    }
  );


  buttons.appendChild(
    clearButton
  );


  /* キャンセル */

  const cancelButton =
    document.createElement(
      "button"
    );


  cancelButton.type =
    "button";

  cancelButton.className =
    "leave-cancel-button";

  cancelButton.textContent =
    "キャンセル";


  cancelButton.addEventListener(
    "click",
    function (
      event
    ) {

      event.stopPropagation();

      closeLeaveMenu();

    }
  );


  buttons.appendChild(
    cancelButton
  );


  const title =
    $("leaveMenuTitle");


  if (title) {

    title.textContent =
      `${staffName} ${dateKey} の休暇`;

  }


  menu.style.display =
    "block";


  positionMenu(
    menu,
    cell
  );

}


/* =========================================================
   メニュー位置
========================================================= */

function positionMenu(
  menu,
  cell
) {

  if (
    !menu ||
    !cell
  ) {

    return;

  }


  const rect =
    cell.getBoundingClientRect();


  menu.style.position =
    "fixed";


  let left =
    rect.left;


  let top =
    rect.bottom + 6;


  const menuWidth =
    menu.offsetWidth ||
    300;


  const menuHeight =
    menu.offsetHeight ||
    300;


  if (
    left +
      menuWidth >
    window.innerWidth -
      10
  ) {

    left =
      window.innerWidth -
      menuWidth -
      10;

  }


  if (left < 10) {
    left = 10;
  }


  if (
    top +
      menuHeight >
    window.innerHeight -
      10
  ) {

    top =
      rect.top -
      menuHeight -
      6;

  }


  if (top < 10) {
    top = 10;
  }


  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

}


/* =========================================================
   メニューを閉じる
========================================================= */

function closeShiftMenu() {

  const menu =
    $("shiftMenu");

  if (menu) {

    menu.style.display =
      "none";

  }

}


function closeLeaveMenu() {

  const menu =
    $("leaveMenu");

  if (menu) {

    menu.style.display =
      "none";

  }


  leaveMenuOpen =
    false;

}


/* =========================================================
   勤務保存
========================================================= */

async function setWorkShift(
  staffName,
  dateKey,
  shiftName
) {

  ensureStaffObject(
    appData.shifts,
    staffName
  );


  ensureStaffObject(
    appData.leaves,
    staffName
  );


  appData.shifts[
    staffName
  ][dateKey] =
    shiftName;


  delete appData.leaves[
    staffName
  ][dateKey];


  saveLocalData();

  renderSchedule();


  if (!supabaseClient) {
    return;
  }


  try {

    cloudOperationBusy =
      true;


    const {
      error
    } =
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
              null

          },
          {
            onConflict:
              "staff_name,work_date"
          }
        );


    if (error) {
      throw error;
    }


    setStatus(
      "保存しました",
      "success"
    );


  } catch (error) {

    console.error(
      "勤務保存エラー:",
      error
    );


    alert(
      "勤務を保存できませんでした。\n\n" +
      error.message
    );


    await loadAllFromSupabase(
      true
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* =========================================================
   休暇保存
========================================================= */

async function setLeave(
  staffName,
  dateKey,
  leaveName
) {

  ensureStaffObject(
    appData.shifts,
    staffName
  );


  ensureStaffObject(
    appData.leaves,
    staffName
  );


  delete appData.shifts[
    staffName
  ][dateKey];


  appData.leaves[
    staffName
  ][dateKey] =
    leaveName;


  saveLocalData();

  renderSchedule();


  if (!supabaseClient) {
    return;
  }


  try {

    cloudOperationBusy =
      true;


    const {
      error
    } =
      await supabaseClient
        .from("work_shifts")
        .upsert(
          {
            staff_name:
              staffName,

            work_date:
              dateKey,

            shift_name:
              null,

            leave_type:
              leaveName

          },
          {
            onConflict:
              "staff_name,work_date"
          }
        );


    if (error) {
      throw error;
    }


    setStatus(
      "休暇を保存しました",
      "success"
    );


  } catch (error) {

    console.error(
      "休暇保存エラー:",
      error
    );


    alert(
      "休暇を保存できませんでした。\n\n" +
      error.message
    );


    await loadAllFromSupabase(
      true
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* =========================================================
   勤務・休暇削除
========================================================= */

async function clearWorkShift(
  staffName,
  dateKey
) {

  ensureStaffObject(
    appData.shifts,
    staffName
  );


  ensureStaffObject(
    appData.leaves,
    staffName
  );


  delete appData.shifts[
    staffName
  ][dateKey];


  delete appData.leaves[
    staffName
  ][dateKey];


  saveLocalData();

  renderSchedule();


  if (!supabaseClient) {
    return;
  }


  try {

    const {
      error
    } =
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
      throw error;
    }


  } catch (error) {

    console.error(
      "勤務削除エラー:",
      error
    );


    alert(
      "削除できませんでした。\n\n" +
      error.message
    );


    await loadAllFromSupabase(
      true
    );

  }

}


/* =========================================================
   職員一覧
   ★ 並び替え復活
========================================================= */

function renderStaffList() {

  const list =
    $("staffList");

  const count =
    $("staffCount");


  if (!list) return;


  list.innerHTML =
    "";


  if (count) {

    count.textContent =
      `職員数：${appData.staff.length}人`;

  }


  appData.staff.forEach(
    (staff, index) => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "list-item";


      const info =
        document.createElement(
          "div"
        );

      info.className =
        "list-item-info";


      const name =
        document.createElement(
          "div"
        );

      name.className =
        "list-item-name";

      name.textContent =
        staff.name;


      info.appendChild(
        name
      );


      const actions =
        document.createElement(
          "div"
        );

      actions.className =
        "list-item-actions";


      /* 上 */

      const upButton =
        document.createElement(
          "button"
        );

      upButton.type =
        "button";

      upButton.className =
        "sort-button";

      upButton.textContent =
        "▲";

      upButton.title =
        "上へ";


      upButton.disabled =
        index === 0;


      upButton.addEventListener(
        "click",
        function () {

          moveStaff(
            index,
            -1
          );

        }
      );


      /* 下 */

      const downButton =
        document.createElement(
          "button"
        );

      downButton.type =
        "button";

      downButton.className =
        "sort-button";

      downButton.textContent =
        "▼";

      downButton.title =
        "下へ";


      downButton.disabled =
        index ===
        appData.staff.length -
          1;


      downButton.addEventListener(
        "click",
        function () {

          moveStaff(
            index,
            1
          );

        }
      );


      /* 編集 */

      const editButton =
        document.createElement(
          "button"
        );

      editButton.type =
        "button";

      editButton.className =
        "edit-button";

      editButton.textContent =
        "編集";


      editButton.addEventListener(
        "click",
        function () {

          editStaff(
            index
          );

        }
      );


      /* 削除 */

      const deleteButton =
        document.createElement(
          "button"
        );

      deleteButton.type =
        "button";

      deleteButton.className =
        "delete-button";

      deleteButton.textContent =
        "削除";


      deleteButton.addEventListener(
        "click",
        function () {

          deleteStaff(
            index
          );

        }
      );


      actions.appendChild(
        upButton
      );

      actions.appendChild(
        downButton
      );

      actions.appendChild(
        editButton
      );

      actions.appendChild(
        deleteButton
      );


      item.appendChild(
        info
      );

      item.appendChild(
        actions
      );


      list.appendChild(
        item
      );

    }
  );

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
    newIndex >=
      appData.staff.length
  ) {

    return;

  }


  const temp =
    appData.staff[index];


  appData.staff[index] =
    appData.staff[newIndex];


  appData.staff[newIndex] =
    temp;


  /* sort_order */

  appData.staff.forEach(
    (staff, i) => {

      staff.sort_order =
        i + 1;

    }
  );


  saveLocalData();

  renderStaffList();

  renderSchedule();


  if (!supabaseClient) {
    return;
  }


  try {

    for (
      let i = 0;
      i <
      appData.staff.length;
      i++
    ) {

      const staff =
        appData.staff[i];


      if (!staff.id) {
        continue;
      }


      const {
        error
      } =
        await supabaseClient
          .from("staff")
          .update(
            {
              sort_order:
                i + 1
            }
          )
          .eq(
            "id",
            staff.id
          );


      if (error) {
        throw error;
      }

    }


    setStatus(
      "並び順を保存しました",
      "success"
    );


  } catch (error) {

    console.error(
      "並び順保存エラー:",
      error
    );


    alert(
      "並び順を保存できませんでした。\n\n" +
      error.message
    );


    await loadAllFromSupabase(
      true
    );

  }

}


/* =========================================================
   職員追加・更新
========================================================= */

async function addOrUpdateStaff() {

  const input =
    $("staffNameInput");

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


  const duplicate =
    appData.staff.some(
      (staff, index) =>
        staff.name === name &&
        index !==
          editingStaffIndex
    );


  if (duplicate) {

    alert(
      "同じ職員名がすでにあります。"
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


    staff.name =
      name;


    try {

      if (
        supabaseClient &&
        staff.id
      ) {

        const {
          error
        } =
          await supabaseClient
            .from("staff")
            .update({
              name: name
            })
            .eq(
              "id",
              staff.id
            );


        if (error) {
          throw error;
        }


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

      }


      renameLocalStaff(
        oldName,
        name
      );


      resetStaffForm();

      saveLocalData();

      renderAll();


    } catch (error) {

      console.error(
        "職員更新エラー:",
        error
      );


      alert(
        "職員を更新できませんでした。\n\n" +
        error.message
      );


      await loadAllFromSupabase(
        true
      );

    }


    return;

  }


  const sortOrder =
    appData.staff.length + 1;


  try {

    if (supabaseClient) {

      const {
        data,
        error
      } =
        await supabaseClient
          .from("staff")
          .insert({
            name: name,
            sort_order:
              sortOrder
          })
          .select()
          .single();


      if (error) {
        throw error;
      }


      appData.staff.push(
        data
      );

    } else {

      appData.staff.push({
        id:
          "local-" +
          Date.now(),

        name: name,

        sort_order:
          sortOrder,

        created_at:
          new Date().toISOString()

      });

    }


    resetStaffForm();

    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "職員追加エラー:",
      error
    );


    alert(
      "職員を追加できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   職員編集
========================================================= */

function editStaff(index) {

  const staff =
    appData.staff[index];

  if (!staff) return;


  editingStaffIndex =
    index;


  const input =
    $("staffNameInput");

  const button =
    $("addStaffButton");


  if (input) {

    input.value =
      staff.name;

    input.focus();

  }


  if (button) {

    button.textContent =
      "職員を更新";

  }

}


/* =========================================================
   職員削除
========================================================= */

async function deleteStaff(index) {

  const staff =
    appData.staff[index];

  if (!staff) return;


  if (
    !confirm(
      `${staff.name}を削除しますか？`
    )
  ) {

    return;

  }


  try {

    if (
      supabaseClient &&
      staff.id
    ) {

      const {
        error:
          shiftError
      } =
        await supabaseClient
          .from("work_shifts")
          .delete()
          .eq(
            "staff_name",
            staff.name
          );


      if (shiftError) {
        throw shiftError;
      }


      const {
        error
      } =
        await supabaseClient
          .from("staff")
          .delete()
          .eq(
            "id",
            staff.id
          );


      if (error) {
        throw error;
      }

    }


    delete appData.shifts[
      staff.name
    ];

    delete appData.leaves[
      staff.name
    ];


    appData.staff.splice(
      index,
      1
    );


    appData.staff.forEach(
      (item, i) => {

        item.sort_order =
          i + 1;

      }
    );


    editingStaffIndex =
      -1;


    resetStaffForm();

    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "職員削除エラー:",
      error
    );


    alert(
      "職員を削除できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   職員名変更
========================================================= */

function renameLocalStaff(
  oldName,
  newName
) {

  if (
    appData.shifts[
      oldName
    ]
  ) {

    appData.shifts[
      newName
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
      newName
    ] =
      appData.leaves[
        oldName
      ];

    delete appData.leaves[
      oldName
    ];

  }

}


/* =========================================================
   職員フォーム
========================================================= */

function resetStaffForm() {

  editingStaffIndex =
    -1;


  const input =
    $("staffNameInput");

  const button =
    $("addStaffButton");


  if (input) {
    input.value = "";
  }


  if (button) {

    button.textContent =
      "職員を追加";

  }

}


/* =========================================================
   勤務形態一覧
========================================================= */

function renderShiftList() {

  const list =
    $("shiftList");

  if (!list) return;


  list.innerHTML =
    "";


  appData.shiftTypes.forEach(
    (shift, index) => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "list-item";


      const info =
        document.createElement(
          "div"
        );

      info.className =
        "list-item-info";


      const name =
        document.createElement(
          "div"
        );

      name.className =
        "list-item-name";

      name.textContent =
        shift.name;


      const detail =
        document.createElement(
          "div"
        );

      detail.className =
        "list-item-detail";


      detail.textContent =
        `${formatTime(
          shift.start_time
        )} ～ ${formatTime(
          shift.end_time
        )}` +
        (
          shift.break_time
            ? `　休憩 ${shift.break_time}`
            : ""
        );


      info.appendChild(
        name
      );

      info.appendChild(
        detail
      );


      const actions =
        createActions(
          function () {
            editShift(index);
          },
          function () {
            deleteShift(index);
          }
        );


      item.appendChild(
        info
      );

      item.appendChild(
        actions
      );


      list.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   勤務形態追加・更新
========================================================= */

async function addOrUpdateShift() {

  const name =
    $("shiftNameInput")?.value.trim();

  const start =
    $("shiftStartInput")?.value || null;

  const end =
    $("shiftEndInput")?.value || null;

  const breakTime =
    $("shiftBreakInput")?.value.trim() || null;


  if (!name) {

    alert(
      "勤務形態名を入力してください。"
    );

    return;

  }


  if (
    appData.shiftTypes.some(
      (shift, index) =>
        shift.name === name &&
        index !==
          editingShiftIndex
    )
  ) {

    alert(
      "同じ勤務形態名があります。"
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


    try {

      if (
        supabaseClient &&
        shift.id
      ) {

        const {
          error
        } =
          await supabaseClient
            .from("shift_types")
            .update({
              name: name,
              start_time: start,
              end_time: end,
              break_time:
                breakTime
            })
            .eq(
              "id",
              shift.id
            );


        if (error) {
          throw error;
        }


        if (
          oldName !== name
        ) {

          const {
            error:
              shiftError
          } =
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


          if (shiftError) {
            throw shiftError;
          }

        }

      }


      shift.name =
        name;

      shift.start_time =
        start;

      shift.end_time =
        end;

      shift.break_time =
        breakTime;


      renameLocalShift(
        oldName,
        name
      );


      resetShiftForm();

      saveLocalData();

      renderAll();


    } catch (error) {

      console.error(
        "勤務形態更新エラー:",
        error
      );


      alert(
        "勤務形態を更新できませんでした。\n\n" +
        error.message
      );


      await loadAllFromSupabase(
        true
      );

    }


    return;

  }


  try {

    if (supabaseClient) {

      const {
        data,
        error
      } =
        await supabaseClient
          .from("shift_types")
          .insert({
            name: name,
            start_time: start,
            end_time: end,
            break_time:
              breakTime
          })
          .select()
          .single();


      if (error) {
        throw error;
      }


      appData.shiftTypes.push(
        data
      );

    } else {

      appData.shiftTypes.push({
        id:
          "local-" +
          Date.now(),

        name,
        start_time:
          start,

        end_time:
          end,

        break_time:
          breakTime

      });

    }


    resetShiftForm();

    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "勤務形態追加エラー:",
      error
    );


    alert(
      "勤務形態を追加できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   勤務形態編集
========================================================= */

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


/* =========================================================
   勤務形態削除
========================================================= */

async function deleteShift(index) {

  const shift =
    appData.shiftTypes[index];

  if (!shift) return;


  if (
    !confirm(
      `${shift.name}を削除しますか？`
    )
  ) {

    return;

  }


  try {

    if (supabaseClient) {

      const {
        data,
        error:
          checkError
      } =
        await supabaseClient
          .from("work_shifts")
          .select("id")
          .eq(
            "shift_name",
            shift.name
          )
          .limit(1);


      if (checkError) {
        throw checkError;
      }


      if (
        data &&
        data.length > 0
      ) {

        alert(
          "この勤務形態は勤務表で使用されているため削除できません。"
        );

        return;

      }


      if (shift.id) {

        const {
          error
        } =
          await supabaseClient
            .from("shift_types")
            .delete()
            .eq(
              "id",
              shift.id
            );


        if (error) {
          throw error;
        }

      }

    }


    appData.shiftTypes.splice(
      index,
      1
    );


    resetShiftForm();

    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "勤務形態削除エラー:",
      error
    );


    alert(
      "勤務形態を削除できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   勤務形態名前変更
========================================================= */

function renameLocalShift(
  oldName,
  newName
) {

  Object.keys(
    appData.shifts
  ).forEach(
    staffName => {

      const dates =
        appData.shifts[
          staffName
        ];

      Object.keys(dates).forEach(
        date => {

          if (
            dates[date] ===
            oldName
          ) {

            dates[date] =
              newName;

          }

        }
      );

    }
  );

}


/* =========================================================
   勤務形態フォーム
========================================================= */

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


/* =========================================================
   休業日一覧
========================================================= */

function renderCompanyHolidayList() {

  const list =
    $("companyHolidayList");

  if (!list) return;


  list.innerHTML =
    "";


  appData.companyHolidays.forEach(
    holiday => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "list-item";


      const info =
        document.createElement(
          "div"
        );

      info.className =
        "list-item-info";


      const name =
        document.createElement(
          "div"
        );

      name.className =
        "list-item-name";

      name.textContent =
        holiday.name;


      const detail =
        document.createElement(
          "div"
        );

      detail.className =
        "list-item-detail";

      detail.textContent =
        holiday.start_date ===
        holiday.end_date
          ? holiday.start_date
          : `${holiday.start_date} ～ ${holiday.end_date}`;


      info.appendChild(
        name
      );

      info.appendChild(
        detail
      );


      const actions =
        createActions(
          function () {
            editHoliday(
              holiday.id
            );
          },
          function () {
            deleteHoliday(
              holiday.id
            );
          }
        );


      item.appendChild(
        info
      );

      item.appendChild(
        actions
      );


      list.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   休業日追加・更新
========================================================= */

async function addOrUpdateHoliday() {

  const name =
    $("companyHolidayName")
      ?.value.trim();

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


  if (
    end &&
    end < start
  ) {

    alert(
      "終了日は開始日以降にしてください。"
    );

    return;

  }


  try {

    if (
      editingHolidayId !==
      null
    ) {

      if (supabaseClient) {

        const {
          error
        } =
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
              editingHolidayId
            );


        if (error) {
          throw error;
        }

      }


      const holiday =
        appData.companyHolidays.find(
          item =>
            item.id ===
            editingHolidayId
        );


      if (holiday) {

        holiday.name =
          name;

        holiday.start_date =
          start;

        holiday.end_date =
          end;

      }


    } else {

      if (supabaseClient) {

        const {
          data,
          error
        } =
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
          throw error;
        }


        appData.companyHolidays.push(
          data
        );

      } else {

        appData.companyHolidays.push({
          id:
            "local-" +
            Date.now(),

          name,
          start_date:
            start,

          end_date:
            end

        });

      }

    }


    resetHolidayForm();

    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "休業日保存エラー:",
      error
    );


    alert(
      "休業日を保存できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   休業日編集
========================================================= */

function editHoliday(id) {

  const holiday =
    appData.companyHolidays.find(
      item =>
        item.id === id
    );

  if (!holiday) return;


  editingHolidayId =
    id;


  $("companyHolidayName").value =
    holiday.name || "";

  $("companyHolidayStart").value =
    holiday.start_date || "";

  $("companyHolidayEnd").value =
    holiday.end_date || "";


  $("addCompanyHolidayButton")
    .textContent =
      "休業日を更新";


  $("companyHolidayName")
    .focus();

}


/* =========================================================
   休業日削除
========================================================= */

async function deleteHoliday(id) {

  const holiday =
    appData.companyHolidays.find(
      item =>
        item.id === id
    );

  if (!holiday) return;


  if (
    !confirm(
      `${holiday.name}を削除しますか？`
    )
  ) {

    return;

  }


  try {

    if (
      supabaseClient &&
      id
    ) {

      const {
        error
      } =
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
        throw error;
      }

    }


    appData.companyHolidays =
      appData.companyHolidays.filter(
        item =>
          item.id !== id
      );


    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "休業日削除エラー:",
      error
    );


    alert(
      "休業日を削除できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   休業日フォーム
========================================================= */

function resetHolidayForm() {

  editingHolidayId =
    null;


  $("companyHolidayName").value =
    "";

  $("companyHolidayStart").value =
    "";

  $("companyHolidayEnd").value =
    "";


  $("addCompanyHolidayButton")
    .textContent =
      "休業日を追加";

}


/* =========================================================
   休暇種類一覧
========================================================= */

function renderLeaveTypeList() {

  const list =
    $("leaveTypeList");

  if (!list) return;


  list.innerHTML =
    "";


  appData.leaveTypes.forEach(
    leaveType => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "list-item";


      const info =
        document.createElement(
          "div"
        );

      info.className =
        "list-item-info leave-list-info";


      const color =
        document.createElement(
          "span"
        );

      color.className =
        "leave-color-preview";


      color.style.backgroundColor =
        leaveType.color ||
        "#d9f2df";


      const name =
        document.createElement(
          "span"
        );

      name.className =
        "list-item-name";

      name.textContent =
        leaveType.name;


      info.appendChild(
        color
      );

      info.appendChild(
        name
      );


      const actions =
        createActions(
          function () {
            editLeaveType(
              leaveType.id
            );
          },
          function () {
            deleteLeaveType(
              leaveType.id
            );
          }
        );


      item.appendChild(
        info
      );

      item.appendChild(
        actions
      );


      list.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   休暇種類追加・更新
========================================================= */

async function addOrUpdateLeaveType() {

  const input =
    $("leaveTypeNameInput");

  const colorInput =
    $("leaveTypeColorInput");


  if (!input) return;


  const name =
    input.value.trim();


  const color =
    colorInput?.value ||
    "#d9f2df";


  if (!name) {

    alert(
      "休暇種類名を入力してください。"
    );

    return;

  }


  const duplicate =
    appData.leaveTypes.some(
      item =>
        item.name === name &&
        item.id !==
          editingLeaveTypeId
    );


  if (duplicate) {

    alert(
      "同じ休暇種類名があります。"
    );

    return;

  }


  try {

    /* 更新 */

    if (
      editingLeaveTypeId !==
      null
    ) {

      const leaveType =
        appData.leaveTypes.find(
          item =>
            item.id ===
            editingLeaveTypeId
        );


      if (!leaveType) {
        return;
      }


      const oldName =
        leaveType.name;


      if (supabaseClient) {

        const {
          error
        } =
          await supabaseClient
            .from(
              "leave_types"
            )
            .update({
              name,
              color
            })
            .eq(
              "id",
              editingLeaveTypeId
            );


        if (error) {
          throw error;
        }


        if (
          oldName !== name
        ) {

          const {
            error:
              workError
          } =
            await supabaseClient
              .from(
                "work_shifts"
              )
              .update({
                leave_type:
                  name
              })
              .eq(
                "leave_type",
                oldName
              );


          if (workError) {
            throw workError;
          }

        }

      }


      leaveType.name =
        name;

      leaveType.color =
        color;


      renameLocalLeave(
        oldName,
        name
      );


    } else {

      /* 新規 */

      if (supabaseClient) {

        const {
          data,
          error
        } =
          await supabaseClient
            .from(
              "leave_types"
            )
            .insert({
              name,
              color
            })
            .select()
            .single();


        if (error) {
          throw error;
        }


        appData.leaveTypes.push(
          data
        );

      } else {

        appData.leaveTypes.push({
          id:
            "local-" +
            Date.now(),

          name,
          color

        });

      }

    }


    resetLeaveTypeForm();

    saveLocalData();

    renderAll();


    setStatus(
      "休暇種類を保存しました",
      "success"
    );


  } catch (error) {

    console.error(
      "休暇種類保存エラー:",
      error
    );


    alert(
      "休暇種類を登録できませんでした。\n\n" +
      error.message
    );


    await loadAllFromSupabase(
      true
    );

  }

}


/* =========================================================
   休暇種類編集
========================================================= */

function editLeaveType(id) {

  const leaveType =
    appData.leaveTypes.find(
      item =>
        item.id === id
    );

  if (!leaveType) return;


  editingLeaveTypeId =
    id;


  $("leaveTypeNameInput").value =
    leaveType.name || "";


  $("leaveTypeColorInput").value =
    leaveType.color ||
    "#d9f2df";


  $("addLeaveTypeButton")
    .textContent =
      "休暇種類を更新";


  $("leaveTypeNameInput")
    .focus();

}


/* =========================================================
   休暇種類削除
========================================================= */

async function deleteLeaveType(id) {

  const leaveType =
    appData.leaveTypes.find(
      item =>
        item.id === id
    );

  if (!leaveType) return;


  if (
    !confirm(
      `${leaveType.name}を削除しますか？`
    )
  ) {

    return;

  }


  try {

    if (supabaseClient) {

      const {
        data,
        error:
          checkError
      } =
        await supabaseClient
          .from(
            "work_shifts"
          )
          .select("id")
          .eq(
            "leave_type",
            leaveType.name
          )
          .limit(1);


      if (checkError) {
        throw checkError;
      }


      if (
        data &&
        data.length > 0
      ) {

        alert(
          "この休暇種類は勤務表で使用されているため削除できません。"
        );

        return;

      }


      const {
        error
      } =
        await supabaseClient
          .from(
            "leave_types"
          )
          .delete()
          .eq(
            "id",
            id
          );


      if (error) {
        throw error;
      }

    }


    appData.leaveTypes =
      appData.leaveTypes.filter(
        item =>
          item.id !== id
      );


    resetLeaveTypeForm();

    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "休暇種類削除エラー:",
      error
    );


    alert(
      "休暇種類を削除できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   休暇種類名前変更
========================================================= */

function renameLocalLeave(
  oldName,
  newName
) {

  Object.keys(
    appData.leaves
  ).forEach(
    staffName => {

      const dates =
        appData.leaves[
          staffName
        ];


      Object.keys(dates).forEach(
        date => {

          if (
            dates[date] ===
            oldName
          ) {

            dates[date] =
              newName;

          }

        }
      );

    }
  );

}


/* =========================================================
   休暇フォーム
========================================================= */

function resetLeaveTypeForm() {

  editingLeaveTypeId =
    null;


  $("leaveTypeNameInput").value =
    "";


  $("leaveTypeColorInput").value =
    "#d9f2df";


  $("addLeaveTypeButton")
    .textContent =
      "休暇種類を追加";

}


/* =========================================================
   明設定
========================================================= */

function renderAkeTime() {

  const start =
    $("akeStartInput");

  const end =
    $("akeEndInput");


  if (start) {

    start.value =
      appData.akeTime.start ||
      "05:30";

  }


  if (end) {

    end.value =
      appData.akeTime.end ||
      "11:15";

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


  appData.akeTime = {
    start,
    end
  };


  saveLocalData();


  try {

    await upsertAppSetting(
      "ake_start",
      start
    );


    await upsertAppSetting(
      "ake_end",
      end
    );


    setStatus(
      "明の時間を保存しました",
      "success"
    );


  } catch (error) {

    console.error(
      "明設定保存エラー:",
      error
    );


    alert(
      "明の時間を保存できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   app_settings
========================================================= */

async function upsertAppSetting(
  settingName,
  settingValue
) {

  if (!supabaseClient) {
    return;
  }


  const {
    error
  } =
    await supabaseClient
      .from("app_settings")
      .upsert(
        {
          setting_name:
            settingName,

          setting_value:
            settingValue
        },
        {
          onConflict:
            "setting_name"
        }
      );


  if (error) {
    throw error;
  }

}


/* =========================================================
   月削除
========================================================= */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  const start =
    formatDateKey(
      new Date(
        year,
        month,
        1
      )
    );


  const end =
    formatDateKey(
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


  try {

    if (supabaseClient) {

      const {
        error
      } =
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
        throw error;
      }

    }


    removeLocalDateRange(
      start,
      end
    );


    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "月削除エラー:",
      error
    );


    alert(
      "削除できませんでした。\n\n" +
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


  const fiscalStartYear =
    month >= 3
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


  try {

    if (supabaseClient) {

      const {
        error
      } =
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
        throw error;
      }

    }


    removeLocalDateRange(
      start,
      end
    );


    saveLocalData();

    renderAll();


  } catch (error) {

    console.error(
      "年度削除エラー:",
      error
    );


    alert(
      "年度削除できませんでした。\n\n" +
      error.message
    );

  }

}


/* =========================================================
   ローカル期間削除
========================================================= */

function removeLocalDateRange(
  start,
  end
) {

  Object.keys(
    appData.shifts
  ).forEach(
    staff => {

      Object.keys(
        appData.shifts[
          staff
        ]
      ).forEach(
        date => {

          if (
            date >= start &&
            date <= end
          ) {

            delete appData.shifts[
              staff
            ][date];

          }

        }
      );

    }
  );


  Object.keys(
    appData.leaves
  ).forEach(
    staff => {

      Object.keys(
        appData.leaves[
          staff
        ]
      ).forEach(
        date => {

          if (
            date >= start &&
            date <= end
          ) {

            delete appData.leaves[
              staff
            ][date];

          }

        }
      );

    }
  );

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
      `${staffName}のカレンダー`;

  }


  if (text) {

    text.textContent =
      `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月の勤務をカレンダーに登録しますか？`;

  }


  modal.classList.add(
    "show"
  );

}


function closeCalendarModal() {

  const modal =
    $("calendarConfirm");


  if (modal) {

    modal.classList.remove(
      "show"
    );

  }


  selectedCalendarStaff =
    null;

}


/* =========================================================
   ICS
========================================================= */

function exportCalendarICS() {

  if (!selectedCalendarStaff) {
    return;
  }


  const staffName =
    selectedCalendarStaff;


  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//勤務表//JP"
  ];


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

    const date =
      new Date(
        year,
        month,
        day
      );


    const dateKey =
      formatDateKey(
        date
      );


    const shift =
      getShift(
        staffName,
        dateKey
      );


    const leave =
      getLeave(
        staffName,
        dateKey
      );


    let summary =
      "";


    if (shift) {

      summary =
        shift;

    } else if (leave) {

      summary =
        leave;

    }


    if (!summary) {
      continue;
    }


    const nextDate =
      new Date(
        year,
        month,
        day + 1
      );


    const start =
      toICSDate(
        date
      );


    const end =
      toICSDate(
        nextDate
      );


    lines.push(
      "BEGIN:VEVENT"
    );


    lines.push(
      `UID:${staffName}-${dateKey}@work-schedule`
    );


    lines.push(
      `DTSTART;VALUE=DATE:${start}`
    );


    lines.push(
      `DTEND;VALUE=DATE:${end}`
    );


    lines.push(
      `SUMMARY:${escapeICS(summary)}`
    );


    lines.push(
      "END:VEVENT"
    );

  }


  lines.push(
    "END:VCALENDAR"
  );


  const blob =
    new Blob(
      [
        lines.join("\r\n")
      ],
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
    `${staffName}_${year}年${month + 1}月.ics`;


  document.body.appendChild(
    a
  );


  a.click();

  a.remove();


  URL.revokeObjectURL(
    url
  );


  closeCalendarModal();

}


/* =========================================================
   ユーティリティ
========================================================= */

function ensureStaffObject(
  object,
  staffName
) {

  if (!object[staffName]) {

    object[staffName] =
      {};

  }

}


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


function findLeaveType(
  name
) {

  return appData.leaveTypes.find(
    item =>
      item.name === name
  );

}


function findShiftType(
  name
) {

  return appData.shiftTypes.find(
    item =>
      item.name === name
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


function formatDateKey(
  date
) {

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


function formatTime(
  value
) {

  if (!value) {
    return "";
  }


  return String(
    value
  ).substring(
    0,
    5
  );

}


function isPublicHoliday(
  dateKey
) {

  return Boolean(
    publicHolidays &&
    publicHolidays[
      dateKey
    ]
  );

}


function isCompanyHoliday(
  dateKey
) {

  return appData.companyHolidays.some(
    holiday => {

      const start =
        holiday.start_date;

      const end =
        holiday.end_date ||
        holiday.start_date;


      return (
        dateKey >= start &&
        dateKey <= end
      );

    }
  );

}


function escapeHtml(
  value
) {

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


function escapeICS(
  value
) {

  return String(
    value ?? ""
  )
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


function toICSDate(
  date
) {

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0")
  ].join("");

}


/* =========================================================
   管理画面ボタン生成
========================================================= */

function createActions(
  editFunction,
  deleteFunction
) {

  const actions =
    document.createElement(
      "div"
    );


  actions.className =
    "list-item-actions";


  const edit =
    document.createElement(
      "button"
    );


  edit.type =
    "button";

  edit.className =
    "edit-button";

  edit.textContent =
    "編集";


  edit.addEventListener(
    "click",
    function () {

      editFunction();

    }
  );


  const del =
    document.createElement(
      "button"
    );


  del.type =
    "button";

  del.className =
    "delete-button";

  del.textContent =
    "削除";


  del.addEventListener(
    "click",
    function () {

      deleteFunction();

    }
  );


  actions.appendChild(
    edit
  );

  actions.appendChild(
    del
  );


  return actions;

}


/* =========================================================
   Status
========================================================= */

function setStatus(
  text,
  type
) {

  const status =
    $("appStatus");

  if (!status) {
    return;
  }


  status.textContent =
    text;


  status.className =
    "app-status";


  if (type) {

    status.classList.add(
      type
    );

  }


  clearTimeout(
    setStatus.timer
  );


  setStatus.timer =
    setTimeout(
      function () {

        status.textContent =
          "オンライン";

        status.className =
          "app-status success";

      },
      3000
    );

}
