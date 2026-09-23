/* =========================================================
   勤務表アプリ 完全版
   Supabase + 勤務表 + 職員管理 + 勤務形態
   + 休業設定 + 休暇種類 + 休暇登録
========================================================= */


/* =========================================================
   Supabase設定
========================================================= */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

let supabaseClient = null;


/* =========================================================
   ローカル保存
========================================================= */

const STORAGE_KEY = "workScheduleAppData";


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


let editingStaffId = null;

let editingShiftId = null;

let editingHolidayId = null;

let editingLeaveTypeId = null;


let selectedCell = null;

let selectedCalendarStaff = null;


let publicHolidays = {};


let realtimeChannel = null;

let realtimeReloadTimer = null;

let autoSyncTimer = null;


let realtimeUpdating = false;

let cloudOperationBusy = false;

let leaveMenuOpen = false;


/* =========================================================
   起動
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


/* =========================================================
   初期化
========================================================= */

async function init() {

  console.log("=================================");
  console.log("勤務表アプリ 起動");
  console.log("=================================");


  try {

    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {

      throw new Error(
        "Supabaseライブラリが読み込まれていません"
      );

    }


    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );


    console.log(
      "Supabaseクライアント作成成功"
    );


  } catch (error) {

    console.error(
      "Supabase初期化エラー",
      error
    );

  }


  loadLocalData();

  bindEvents();

  renderAll();


  if (supabaseClient) {

    try {

      await loadAllFromSupabase();

      console.log(
        "Supabaseからの読み込み完了"
      );

      renderAll();

    } catch (error) {

      console.error(
        "Supabase読み込みエラー",
        error
      );

      console.error(
        "エラー内容:",
        error.message
      );

    }


    setupRealtime();

    startAutoSync();

    setupVisibilitySync();

  }


  loadPublicHolidays();


  console.log(
    "勤務表アプリ 初期化完了"
  );

}


/* =========================================================
   ローカル読み込み
========================================================= */

function loadLocalData() {

  try {

    const saved =
      localStorage.getItem(
        STORAGE_KEY
      );


    if (!saved) {

      return;

    }


    const parsed =
      JSON.parse(saved);


    appData.staff =
      Array.isArray(parsed.staff)
        ? parsed.staff
        : [];


    appData.shiftTypes =
      Array.isArray(parsed.shiftTypes)
        ? parsed.shiftTypes
        : [];


    appData.leaveTypes =
      Array.isArray(parsed.leaveTypes)
        ? parsed.leaveTypes
        : [];


    appData.companyHolidays =
      Array.isArray(parsed.companyHolidays)
        ? parsed.companyHolidays
        : [];


    appData.shifts =
      parsed.shifts &&
      typeof parsed.shifts === "object"
        ? parsed.shifts
        : {};


    appData.leaves =
      parsed.leaves &&
      typeof parsed.leaves === "object"
        ? parsed.leaves
        : {};


    appData.akeTime =
      parsed.akeTime &&
      typeof parsed.akeTime === "object"
        ? {

            start:
              parsed.akeTime.start ||
              "05:30",

            end:
              parsed.akeTime.end ||
              "11:15"

          }
        : {

            start: "05:30",

            end: "11:15"

          };


    console.log(
      "ローカルデータ読み込み",
      appData
    );


  } catch (error) {

    console.error(
      "ローカルデータ読み込みエラー",
      error
    );

  }

}


/* =========================================================
   ローカル保存
========================================================= */

function saveLocalData() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({

        staff:
          appData.staff,

        shiftTypes:
          appData.shiftTypes,

        leaveTypes:
          appData.leaveTypes,

        companyHolidays:
          appData.companyHolidays,

        shifts:
          appData.shifts,

        leaves:
          appData.leaves,

        akeTime:
          appData.akeTime

      })
    );


  } catch (error) {

    console.error(
      "ローカル保存エラー",
      error
    );

  }

}


/* =========================================================
   Supabaseから全部読み込み
========================================================= */

async function loadAllFromSupabase() {

  if (!supabaseClient) {

    throw new Error(
      "Supabaseクライアントがありません"
    );

  }


  console.log(
    "---------------------------------"
  );

  console.log(
    "Supabaseデータ読み込み開始"
  );

  console.log(
    "---------------------------------"
  );


  /* =====================================================
     職員
  ===================================================== */

  const staffResult =
    await supabaseClient
      .from("staff")
      .select(
        "id,name,created_at,sort_order,calendar_token"
      );


  if (staffResult.error) {

    console.error(
      "職員読み込みエラー:",
      staffResult.error
    );

    throw staffResult.error;

  }


  const staffRows =
    Array.isArray(staffResult.data)
      ? staffResult.data
      : [];


  staffRows.sort(
    function(a, b) {

      const aOrder =
        Number.isFinite(
          Number(a.sort_order)
        )
          ? Number(a.sort_order)
          : 999999;


      const bOrder =
        Number.isFinite(
          Number(b.sort_order)
        )
          ? Number(b.sort_order)
          : 999999;


      if (aOrder !== bOrder) {

        return aOrder - bOrder;

      }


      return String(
        a.name || ""
      ).localeCompare(
        String(b.name || ""),
        "ja"
      );

    }
  );


  appData.staff =
    staffRows.filter(
      function(staff) {

        return (
          staff &&
          staff.name &&
          staff.name !== "明"
        );

      }
    );


  console.log(
    "職員:",
    appData.staff.length,
    "人"
  );


  /* =====================================================
     勤務形態
  ===================================================== */

  const shiftResult =
    await supabaseClient
      .from("shift_types")
      .select(
        "id,name,created_at,start_time,end_time,break_time"
      );


  if (shiftResult.error) {

    console.error(
      "勤務形態読み込みエラー:",
      shiftResult.error
    );

    throw shiftResult.error;

  }


  appData.shiftTypes =
    Array.isArray(shiftResult.data)
      ? shiftResult.data
      : [];


  appData.shiftTypes =
    appData.shiftTypes.filter(
      function(shift) {

        return (
          shift &&
          shift.name &&
          shift.name !== "明"
        );

      }
    );


  appData.shiftTypes.sort(
    function(a, b) {

      return String(
        a.name
      ).localeCompare(
        String(b.name),
        "ja"
      );

    }
  );


  console.log(
    "勤務形態:",
    appData.shiftTypes.length,
    "件"
  );


  /* =====================================================
     休暇種類
  ===================================================== */

  const leaveTypeResult =
    await supabaseClient
      .from("leave_types")
      .select(
        "id,name,color,created_at"
      );


  if (leaveTypeResult.error) {

    console.error(
      "休暇種類読み込みエラー:",
      leaveTypeResult.error
    );

    appData.leaveTypes = [];

  } else {

    appData.leaveTypes =
      Array.isArray(
        leaveTypeResult.data
      )
        ? leaveTypeResult.data
        : [];

  }


  appData.leaveTypes.sort(
    function(a, b) {

      return String(
        a.name || ""
      ).localeCompare(
        String(b.name || ""),
        "ja"
      );

    }
  );


  console.log(
    "休暇種類:",
    appData.leaveTypes.length,
    "件"
  );


  /* =====================================================
     勤務・休暇
  ===================================================== */

  const workResult =
    await supabaseClient
      .from("work_shifts")
      .select(
        "id,staff_name,work_date,shift_name,leave_type"
      );


  if (workResult.error) {

    console.error(
      "勤務データ読み込みエラー:",
      workResult.error
    );

    throw workResult.error;

  }


  appData.shifts = {};

  appData.leaves = {};


  const workRows =
    Array.isArray(workResult.data)
      ? workResult.data
      : [];


  workRows.forEach(
    function(row) {

      if (
        !row ||
        !row.staff_name ||
        !row.work_date
      ) {

        return;

      }


      const staffName =
        row.staff_name;

      const dateKey =
        String(row.work_date)
          .slice(0, 10);


      if (!appData.shifts[staffName]) {

        appData.shifts[staffName] = {};

      }


      if (!appData.leaves[staffName]) {

        appData.leaves[staffName] = {};

      }


      if (
        row.leave_type &&
        String(row.leave_type).trim() !== ""
      ) {

        appData.leaves[staffName][dateKey] =
          String(row.leave_type);


        delete
          appData.shifts[staffName][dateKey];


      } else if (
        row.shift_name &&
        String(row.shift_name).trim() !== ""
      ) {

        appData.shifts[staffName][dateKey] =
          String(row.shift_name);


        delete
          appData.leaves[staffName][dateKey];

      }

    }
  );


  console.log(
    "勤務データ:",
    workRows.length,
    "件"
  );


  /* =====================================================
     休業日
  ===================================================== */

  const holidayResult =
    await supabaseClient
      .from("company_holidays")
      .select(
        "id,name,start_date,end_date,created_at"
      );


  if (holidayResult.error) {

    console.error(
      "休業日読み込みエラー:",
      holidayResult.error
    );

    throw holidayResult.error;

  }


  appData.companyHolidays =
    Array.isArray(
      holidayResult.data
    )
      ? holidayResult.data
      : [];


  appData.companyHolidays.sort(
    function(a, b) {

      return String(
        a.start_date || ""
      ).localeCompare(
        String(b.start_date || "")
      );

    }
  );


  console.log(
    "休業日:",
    appData.companyHolidays.length,
    "件"
  );


  /* =====================================================
     明け時間
  ===================================================== */

  const settingResult =
    await supabaseClient
      .from("app_settings")
      .select(
        "setting_name,setting_value"
      );


  if (
    settingResult.error
  ) {

    console.warn(
      "設定読み込みエラー:",
      settingResult.error
    );

  } else {

    const settings =
      Array.isArray(
        settingResult.data
      )
        ? settingResult.data
        : [];


    const akeStart =
      settings.find(
        function(item) {

          return (
            item.setting_name ===
            "ake_start"
          );

        }
      );


    const akeEnd =
      settings.find(
        function(item) {

          return (
            item.setting_name ===
            "ake_end"
          );

        }
      );


    if (akeStart) {

      appData.akeTime.start =
        akeStart.setting_value ||
        "05:30";

    }


    if (akeEnd) {

      appData.akeTime.end =
        akeEnd.setting_value ||
        "11:15";

    }

  }


  saveLocalData();


  console.log(
    "---------------------------------"
  );

  console.log(
    "Supabaseデータ読み込み完了"
  );

  console.log(
    "---------------------------------"
  );

}


/* =========================================================
   Realtime
========================================================= */

function setupRealtime() {

  if (!supabaseClient) {

    return;

  }


  if (realtimeChannel) {

    try {

      supabaseClient.removeChannel(
        realtimeChannel
      );

    } catch (error) {

      console.warn(
        "Realtimeチャンネル削除エラー",
        error
      );

    }

  }


  realtimeChannel =
    supabaseClient
      .channel(
        "kinmu-app-realtime"
      )


      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff"
        },
        function(payload) {

          console.log(
            "Realtime staff",
            payload
          );

          scheduleRealtimeReload();

        }
      )


      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shift_types"
        },
        function(payload) {

          console.log(
            "Realtime shift_types",
            payload
          );

          scheduleRealtimeReload();

        }
      )


      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_shifts"
        },
        function(payload) {

          console.log(
            "Realtime work_shifts",
            payload
          );

          scheduleRealtimeReload();

        }
      )


      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_holidays"
        },
        function(payload) {

          console.log(
            "Realtime company_holidays",
            payload
          );

          scheduleRealtimeReload();

        }
      )


      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_types"
        },
        function(payload) {

          console.log(
            "Realtime leave_types",
            payload
          );

          scheduleRealtimeReload();

        }
      )


      .subscribe(
        function(status) {

          console.log(
            "Supabase Realtime:",
            status
          );


          if (
            status === "SUBSCRIBED"
          ) {

            console.log(
              "★ Realtime接続成功"
            );

          }

        }
      );

}


/* =========================================================
   Realtime再読み込み
========================================================= */

function scheduleRealtimeReload() {

  clearTimeout(
    realtimeReloadTimer
  );


  realtimeReloadTimer =
    setTimeout(
      async function() {

        await reloadFromSupabase();

      },
      500
    );

}


/* =========================================================
   Supabase再読み込み
========================================================= */

async function reloadFromSupabase() {

  if (!supabaseClient) {

    return;

  }


  if (cloudOperationBusy) {

    console.log(
      "保存中のためRealtime読み込みをスキップ"
    );

    return;

  }


  if (realtimeUpdating) {

    return;

  }


  realtimeUpdating = true;


  try {

    await loadAllFromSupabase();

    renderAll();

  } catch (error) {

    console.error(
      "Realtime再読み込みエラー",
      error
    );

  } finally {

    realtimeUpdating = false;

  }

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
      async function() {

        if (
          document.visibilityState !==
          "visible"
        ) {

          return;

        }


        if (cloudOperationBusy) {

          return;

        }


        await reloadFromSupabase();

      },
      10000
    );

}


/* =========================================================
   画面復帰時同期
========================================================= */

function setupVisibilitySync() {

  document.addEventListener(
    "visibilitychange",
    async function() {

      if (
        document.visibilityState ===
        "visible"
      ) {

        await reloadFromSupabase();

      }

    }
  );

}


/* =========================================================
   イベント登録
========================================================= */

function bindEvents() {


  /* =====================================================
     ナビ
  ===================================================== */

  document
    .querySelectorAll(".nav-button")
    .forEach(
      function(button) {

        button.addEventListener(
          "click",
          function() {

            showPage(
              button.dataset.page
            );

          }
        );

      }
    );


  /* =====================================================
     月
  ===================================================== */

  const prevMonth =
    document.getElementById(
      "prevMonth"
    );


  if (prevMonth) {

    prevMonth.addEventListener(
      "click",
      function() {

        currentDate.setMonth(
          currentDate.getMonth() - 1
        );

        renderSchedule();

      }
    );

  }


  const nextMonth =
    document.getElementById(
      "nextMonth"
    );


  if (nextMonth) {

    nextMonth.addEventListener(
      "click",
      function() {

        currentDate.setMonth(
          currentDate.getMonth() + 1
        );

        renderSchedule();

      }
    );

  }


  /* =====================================================
     職員
  ===================================================== */

  const addStaffButton =
    document.getElementById(
      "addStaffButton"
    );


  if (addStaffButton) {

    addStaffButton.addEventListener(
      "click",
      addOrUpdateStaff
    );

  }


  /* =====================================================
     勤務形態
  ===================================================== */

  const addShiftButton =
    document.getElementById(
      "addShiftButton"
    );


  if (addShiftButton) {

    addShiftButton.addEventListener(
      "click",
      addOrUpdateShift
    );

  }


  /* =====================================================
     休業
  ===================================================== */

  const addCompanyHolidayButton =
    document.getElementById(
      "addCompanyHolidayButton"
    );


  if (addCompanyHolidayButton) {

    addCompanyHolidayButton.addEventListener(
      "click",
      addOrUpdateCompanyHoliday
    );

  }


  /* =====================================================
     明け時間
  ===================================================== */

  const saveAkeTimeButton =
    document.getElementById(
      "saveAkeTimeButton"
    );


  if (saveAkeTimeButton) {

    saveAkeTimeButton.addEventListener(
      "click",
      saveAkeTime
    );

  }


  /* =====================================================
     休暇種類
  ===================================================== */

  const addLeaveTypeButton =
    document.getElementById(
      "addLeaveTypeButton"
    );


  if (addLeaveTypeButton) {

    addLeaveTypeButton.addEventListener(
      "click",
      addOrUpdateLeaveType
    );

  }


  /* =====================================================
     カレンダー
  ===================================================== */

  const calendarCancelButton =
    document.getElementById(
      "calendarCancelButton"
    );


  if (calendarCancelButton) {

    calendarCancelButton.addEventListener(
      "click",
      closeCalendarModal
    );

  }


  const calendarOKButton =
    document.getElementById(
      "calendarOKButton"
    );


  if (calendarOKButton) {

    calendarOKButton.addEventListener(
      "click",
      subscribeStaffCalendar
    );

  }


  /* =====================================================
     月消去
  ===================================================== */

  const deleteMonthButton =
    document.getElementById(
      "deleteMonthButton"
    );


  if (deleteMonthButton) {

    deleteMonthButton.addEventListener(
      "click",
      deleteCurrentMonth
    );

  }


  /* =====================================================
     年度消去
  ===================================================== */

  const deleteFiscalYearButton =
    document.getElementById(
      "deleteFiscalYearButton"
    );


  if (deleteFiscalYearButton) {

    deleteFiscalYearButton.addEventListener(
      "click",
      deleteFiscalYear
    );

  }


  /* =====================================================
     勤務表
  ===================================================== */

  const scheduleTable =
    document.getElementById(
      "scheduleTable"
    );


  if (scheduleTable) {

    scheduleTable.addEventListener(
      "click",
      function(event) {

        const shiftCell =
          event.target.closest(
            ".shift-cell"
          );


        if (shiftCell) {

          event.stopPropagation();


          if (leaveMenuOpen) {

            hideLeaveMenu();

            return;

          }


          const staffName =
            shiftCell.dataset.staff;


          const dateKey =
            shiftCell.dataset.date;


          showShiftMenu(
            shiftCell,
            staffName,
            dateKey
          );


          return;

        }


        const staffCell =
          event.target.closest(
            ".staff-name-cell"
          );


        if (staffCell) {

          event.stopPropagation();


          if (leaveMenuOpen) {

            hideLeaveMenu();

            return;

          }


          const staffId =
            staffCell.dataset.staffId;


          const staff =
            appData.staff.find(
              function(item) {

                return String(
                  item.id
                ) ===
                String(staffId);

              }
            );


          if (staff) {

            openCalendarModal(
              staff
            );

          }

        }

      }
    );

  }


  /* =====================================================
     画面外クリック
  ===================================================== */

  document.addEventListener(
    "click",
    function(event) {

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
        shiftMenu.contains(event.target)
      ) {

        return;

      }


      if (
        leaveMenu &&
        leaveMenu.contains(event.target)
      ) {

        return;

      }


      if (
        event.target.closest(
          ".shift-cell"
        )
      ) {

        return;

      }


      if (
        event.target.closest(
          ".staff-name-cell"
        )
      ) {

        return;

      }


      hideShiftMenu();

      hideLeaveMenu();

    }
  );

}


/* =========================================================
   ページ切り替え
========================================================= */

function showPage(pageName) {

  document
    .querySelectorAll(".page")
    .forEach(
      function(page) {

        page.style.display =
          "none";

      }
    );


  const target =
    document.getElementById(
      pageName + "Page"
    );


  if (target) {

    target.style.display =
      "";

  }


  document
    .querySelectorAll(".nav-button")
    .forEach(
      function(button) {

        button.classList.toggle(
          "active",
          button.dataset.page ===
          pageName
        );

      }
    );


  hideShiftMenu();

  hideLeaveMenu();


  renderAll();

}


/* =========================================================
   全体描画
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
   勤務表描画
========================================================= */

function renderSchedule() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (!table) {

    return;

  }


  const monthTitle =
    document.getElementById(
      "currentMonth"
    );


  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth();


  if (monthTitle) {

    monthTitle.textContent =
      year +
      "年" +
      (month + 1) +
      "月";

  }


  table.innerHTML = "";


  const dates =
    getDaysInMonth(
      year,
      month
    );


  /* =====================================================
     ヘッダー
  ===================================================== */

  const thead =
    document.createElement(
      "thead"
    );


  const headerRow =
    document.createElement(
      "tr"
    );


  const staffHeader =
    document.createElement(
      "th"
    );


  staffHeader.className =
    "staff-header";


  staffHeader.textContent =
    "職員";


  headerRow.appendChild(
    staffHeader
  );


  dates.forEach(
    function(dateKey) {

      const th =
        document.createElement(
          "th"
        );


      th.className =
        "date-header";


      const date =
        new Date(
          dateKey + "T00:00:00"
        );


      const day =
        date.getDate();


      const week =
        date.getDay();


      th.innerHTML =
        day +
        "<br>" +
        "<span>" +
        getWeekName(week) +
        "</span>";


      applyDateClass(
        th,
        dateKey
      );


      headerRow.appendChild(
        th
      );

    }
  );


  appData.shiftTypes.forEach(
    function(shift) {

      const th =
        document.createElement(
          "th"
        );


      th.className =
        "total-header";


      th.textContent =
        shift.name;


      headerRow.appendChild(
        th
      );

    }
  );


  const totalHeader =
    document.createElement(
      "th"
    );


  totalHeader.className =
    "total-header";


  totalHeader.textContent =
    "合計";


  headerRow.appendChild(
    totalHeader
  );


  thead.appendChild(
    headerRow
  );


  table.appendChild(
    thead
  );


  /* =====================================================
     本体
  ===================================================== */

  const tbody =
    document.createElement(
      "tbody"
    );


  appData.staff.forEach(
    function(staff) {

      const tr =
        document.createElement(
          "tr"
        );


      /* -------------------------------------------------
         職員名
      ------------------------------------------------- */

      const nameCell =
        document.createElement(
          "th"
        );


      nameCell.className =
        "staff-name-cell";


      nameCell.dataset.staffId =
        staff.id;


      nameCell.textContent =
        staff.name;


      nameCell.title =
        "タップするとカレンダー登録";


      tr.appendChild(
        nameCell
      );


      const countMap = {};


      appData.shiftTypes.forEach(
        function(shift) {

          countMap[shift.name] =
            0;

        }
      );


      let totalCount = 0;


      /* -------------------------------------------------
         日付
      ------------------------------------------------- */

      dates.forEach(
        function(dateKey) {

          const td =
            document.createElement(
              "td"
            );


          td.className =
            "shift-cell";


          td.dataset.staff =
            staff.name;


          td.dataset.date =
            dateKey;


          const display =
            getDisplayForDate(
              staff.name,
              dateKey
            );


          td.textContent =
            display.text || "";


          applyDateClass(
            td,
            dateKey
          );


          if (
            display.type ===
            "leave"
          ) {

            td.classList.add(
              "shift-leave"
            );


            td.style.backgroundColor =
              safeColor(
                display.color,
                "#d9f2df"
              );


            td.title =
              "休暇：" +
              display.text;

          }


          if (
            display.type ===
            "ake"
          ) {

            td.classList.add(
              "shift-ake"
            );

          }


          if (
            display.type ===
            "shift"
          ) {

            if (
              Object.prototype.hasOwnProperty.call(
                countMap,
                display.text
              )
            ) {

              countMap[
                display.text
              ]++;

            }


            totalCount++;

          }


          tr.appendChild(
            td
          );

        }
      );


      /* -------------------------------------------------
         勤務別合計
      ------------------------------------------------- */

      appData.shiftTypes.forEach(
        function(shift) {

          const td =
            document.createElement(
              "td"
            );


          td.className =
            "total-cell";


          td.textContent =
            countMap[shift.name] ||
            0;


          tr.appendChild(
            td
          );

        }
      );


      /* -------------------------------------------------
         合計
      ------------------------------------------------- */

      const totalCell =
        document.createElement(
          "td"
        );


      totalCell.className =
        "total-cell total-all";


      totalCell.textContent =
        totalCount;


      tr.appendChild(
        totalCell
      );


      tbody.appendChild(
        tr
      );

    }
  );


  table.appendChild(
    tbody
  );

}


/* =========================================================
   表示内容取得
========================================================= */

function getDisplayForDate(
  staffName,
  dateKey
) {

  /* -----------------------------------------------------
     休暇を最優先
  ----------------------------------------------------- */

  if (
    appData.leaves[staffName] &&
    appData.leaves[staffName][dateKey]
  ) {

    const leaveName =
      appData.leaves[staffName][dateKey];


    const leaveType =
      appData.leaveTypes.find(
        function(item) {

          return (
            item.name ===
            leaveName
          );

        }
      );


    return {

      type: "leave",

      text: leaveName,

      color:
        leaveType
          ? leaveType.color
          : "#d9f2df"

    };

  }


  /* -----------------------------------------------------
     通常勤務
  ----------------------------------------------------- */

  if (
    appData.shifts[staffName] &&
    appData.shifts[staffName][dateKey]
  ) {

    return {

      type: "shift",

      text:
        appData.shifts[
          staffName
        ][dateKey]

    };

  }


  /* -----------------------------------------------------
     明
  ----------------------------------------------------- */

  const previousDate =
    getPreviousDateKey(
      dateKey
    );


  if (
    appData.shifts[staffName] &&
    appData.shifts[staffName][previousDate]
  ) {

    const previousShift =
      appData.shifts[
        staffName
      ][previousDate];


    if (
      isAkeShift(
        previousShift
      )
    ) {

      return {

        type: "ake",

        text: "明"

      };

    }

  }


  return {

    type: "",

    text: ""

  };

}


/* =========================================================
   明判定
========================================================= */

function isAkeShift(
  shiftName
) {

  if (!shiftName) {

    return false;

  }


  const text =
    String(
      shiftName
    );


  return (
    text.includes("宿") ||
    text.includes("夜")
  );

}


/* =========================================================
   日付取得
========================================================= */

function getDaysInMonth(
  year,
  month
) {

  const result = [];


  const lastDay =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  for (
    let day = 1;
    day <= lastDay;
    day++
  ) {

    result.push(
      formatDateKey(
        new Date(
          year,
          month,
          day
        )
      )
    );

  }


  return result;

}


/* =========================================================
   日付キー
========================================================= */

function formatDateKey(
  date
) {

  const y =
    date.getFullYear();


  const m =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");


  const d =
    String(
      date.getDate()
    ).padStart(2, "0");


  return (
    y +
    "-" +
    m +
    "-" +
    d
  );

}


/* =========================================================
   前日
========================================================= */

function getPreviousDateKey(
  dateKey
) {

  const date =
    new Date(
      dateKey + "T00:00:00"
    );


  date.setDate(
    date.getDate() - 1
  );


  return formatDateKey(
    date
  );

}


/* =========================================================
   曜日
========================================================= */

function getWeekName(
  day
) {

  return [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
  ][day];

}


/* =========================================================
   日付クラス
========================================================= */

function applyDateClass(
  element,
  dateKey
) {

  const date =
    new Date(
      dateKey + "T00:00:00"
    );


  const day =
    date.getDay();


  if (day === 0) {

    element.classList.add(
      "sunday"
    );

  }


  if (day === 6) {

    element.classList.add(
      "saturday"
    );

  }


  if (publicHolidays[dateKey]) {

    element.classList.add(
      "holiday"
    );

    element.title =
      publicHolidays[dateKey];

  }


  if (
    isCompanyHoliday(
      dateKey
    )
  ) {

    element.classList.add(
      "company-holiday"
    );

  }

}


/* =========================================================
   会社休業判定
========================================================= */

function isCompanyHoliday(
  dateKey
) {

  return appData.companyHolidays.some(
    function(item) {

      const start =
        String(
          item.start_date || ""
        ).slice(0, 10);


      const end =
        String(
          item.end_date ||
          item.start_date ||
          ""
        ).slice(0, 10);


      return (
        dateKey >= start &&
        dateKey <= end
      );

    }
  );

}


/* =========================================================
   職員一覧
========================================================= */

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
      appData.staff.length +
      "人";

  }


  appData.staff.forEach(
    function(staff) {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "list-item";


      const name =
        document.createElement(
          "div"
        );


      name.className =
        "list-item-name";


      name.textContent =
        staff.name;


      const buttons =
        document.createElement(
          "div"
        );


      buttons.className =
        "list-item-buttons";


      const editButton =
        createActionButton(
          "編集",
          "edit",
          function() {

            startEditStaff(
              staff
            );

          }
        );


      const deleteButton =
        createActionButton(
          "削除",
          "delete",
          function() {

            deleteStaff(
              staff
            );

          }
        );


      buttons.appendChild(
        editButton
      );


      buttons.appendChild(
        deleteButton
      );


      item.appendChild(
        name
      );


      item.appendChild(
        buttons
      );


      list.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   職員追加・更新
========================================================= */

async function addOrUpdateStaff() {

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


  if (name === "明") {

    alert(
      "「明」は登録できません。"
    );

    return;

  }


  const duplicate =
    appData.staff.some(
      function(staff) {

        return (
          staff.name === name &&
          String(staff.id) !==
          String(editingStaffId)
        );

      }
    );


  if (duplicate) {

    alert(
      "同じ職員名が登録されています。"
    );

    return;

  }


  if (!supabaseClient) {

    alert(
      "Supabaseに接続されていません。"
    );

    return;

  }


  setCloudBusy(true);


  try {

    if (editingStaffId !== null) {

      const oldStaff =
        appData.staff.find(
          function(staff) {

            return String(
              staff.id
            ) ===
            String(editingStaffId);

          }
        );


      if (!oldStaff) {

        return;

      }


      const oldName =
        oldStaff.name;


      const workUpdate =
        await supabaseClient
          .from("work_shifts")
          .update({
            staff_name: name
          })
          .eq(
            "staff_name",
            oldName
          );


      if (workUpdate.error) {

        throw workUpdate.error;

      }


      const update =
        await supabaseClient
          .from("staff")
          .update({
            name: name
          })
          .eq(
            "id",
            editingStaffId
          );


      if (update.error) {

        await supabaseClient
          .from("work_shifts")
          .update({
            staff_name: oldName
          })
          .eq(
            "staff_name",
            name
          );

        throw update.error;

      }


      alert(
        "職員名を更新しました。"
      );


    } else {

      const nextOrder =
        appData.staff.length + 1;


      const insert =
        await supabaseClient
          .from("staff")
          .insert({

            name: name,

            sort_order:
              nextOrder,

            calendar_token:
              createRandomToken()

          });


      if (insert.error) {

        throw insert.error;

      }


      alert(
        "職員を追加しました。"
      );

    }


    editingStaffId = null;

    input.value = "";


    setStaffButtonText();


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "職員保存エラー",
      error
    );


    alert(
      "職員を保存できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   職員編集
========================================================= */

function startEditStaff(
  staff
) {

  const input =
    document.getElementById(
      "staffNameInput"
    );


  if (!input) {

    return;

  }


  editingStaffId =
    staff.id;


  input.value =
    staff.name;


  setStaffButtonText();


  input.focus();

}


/* =========================================================
   職員ボタン文字
========================================================= */

function setStaffButtonText() {

  const button =
    document.getElementById(
      "addStaffButton"
    );


  if (!button) {

    return;

  }


  button.textContent =
    editingStaffId !== null
      ? "職員名を更新"
      : "追加";

}


/* =========================================================
   職員削除
========================================================= */

async function deleteStaff(
  staff
) {

  if (!staff) {

    return;

  }


  const ok =
    confirm(
      "「" +
      staff.name +
      "」を削除しますか？\n\n" +
      "この職員の勤務データも削除されます。"
    );


  if (!ok) {

    return;

  }


  setCloudBusy(true);


  try {

    const workDelete =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "staff_name",
          staff.name
        );


    if (workDelete.error) {

      throw workDelete.error;

    }


    const deleteResult =
      await supabaseClient
        .from("staff")
        .delete()
        .eq(
          "id",
          staff.id
        );


    if (deleteResult.error) {

      throw deleteResult.error;

    }


    delete appData.shifts[
      staff.name
    ];


    delete appData.leaves[
      staff.name
    ];


    if (
      String(editingStaffId) ===
      String(staff.id)
    ) {

      editingStaffId = null;

      setStaffButtonText();

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "職員削除エラー",
      error
    );


    alert(
      "職員を削除できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   勤務形態一覧
========================================================= */

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
    function(shift) {

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
        "list-item-name";


      const breakText =
        shift.break_time !== null &&
        shift.break_time !== undefined &&
        shift.break_time !== ""
          ? " / 休憩 " +
            shift.break_time +
            "分"
          : "";


      info.textContent =
        shift.name +
        "  " +
        (shift.start_time || "") +
        " ～ " +
        (shift.end_time || "") +
        breakText;


      const buttons =
        document.createElement(
          "div"
        );


      buttons.className =
        "list-item-buttons";


      const editButton =
        createActionButton(
          "編集",
          "edit",
          function() {

            startEditShift(
              shift
            );

          }
        );


      const deleteButton =
        createActionButton(
          "削除",
          "delete",
          function() {

            deleteShift(
              shift
            );

          }
        );


      buttons.appendChild(
        editButton
      );


      buttons.appendChild(
        deleteButton
      );


      item.appendChild(
        info
      );


      item.appendChild(
        buttons
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


  if (
    !nameInput ||
    !startInput ||
    !endInput ||
    !breakInput
  ) {

    return;

  }


  const name =
    nameInput.value.trim();


  const start =
    startInput.value;


  const end =
    endInput.value;


  const breakTime =
    breakInput.value === ""
      ? 0
      : Number(
          breakInput.value
        );


  if (!name) {

    alert(
      "勤務形態名を入力してください。"
    );

    return;

  }


  if (name === "明") {

    alert(
      "「明」は登録できません。"
    );

    return;

  }


  if (!start || !end) {

    alert(
      "開始時間と終了時間を入力してください。"
    );

    return;

  }


  const duplicate =
    appData.shiftTypes.some(
      function(shift) {

        return (
          shift.name === name &&
          String(shift.id) !==
          String(editingShiftId)
        );

      }
    );


  if (duplicate) {

    alert(
      "同じ勤務形態名が登録されています。"
    );

    return;

  }


  setCloudBusy(true);


  try {

    if (editingShiftId !== null) {

      const result =
        await supabaseClient
          .from("shift_types")
          .update({

            name: name,

            start_time:
              start,

            end_time:
              end,

            break_time:
              breakTime

          })
          .eq(
            "id",
            editingShiftId
          );


      if (result.error) {

        throw result.error;

      }


      alert(
        "勤務形態を更新しました。"
      );


    } else {

      const result =
        await supabaseClient
          .from("shift_types")
          .insert({

            name: name,

            start_time:
              start,

            end_time:
              end,

            break_time:
              breakTime

          });


      if (result.error) {

        throw result.error;

      }


      alert(
        "勤務形態を追加しました。"
      );

    }


    editingShiftId = null;


    nameInput.value = "";

    startInput.value = "";

    endInput.value = "";

    breakInput.value = "";


    setShiftButtonText();


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "勤務形態保存エラー",
      error
    );


    alert(
      "勤務形態を保存できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   勤務形態編集
========================================================= */

function startEditShift(
  shift
) {

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


  if (
    !nameInput ||
    !startInput ||
    !endInput ||
    !breakInput
  ) {

    return;

  }


  editingShiftId =
    shift.id;


  nameInput.value =
    shift.name || "";


  startInput.value =
    shift.start_time || "";


  endInput.value =
    shift.end_time || "";


  breakInput.value =
    shift.break_time ??
    "";


  setShiftButtonText();


  nameInput.focus();

}


/* =========================================================
   勤務形態ボタン
========================================================= */

function setShiftButtonText() {

  const button =
    document.getElementById(
      "addShiftButton"
    );


  if (!button) {

    return;

  }


  button.textContent =
    editingShiftId !== null
      ? "勤務形態を更新"
      : "勤務形態を追加";

}


/* =========================================================
   勤務形態削除
========================================================= */

async function deleteShift(
  shift
) {

  const ok =
    confirm(
      "「" +
      shift.name +
      "」を削除しますか？"
    );


  if (!ok) {

    return;

  }


  setCloudBusy(true);


  try {

    const usedResult =
      await supabaseClient
        .from("work_shifts")
        .select(
          "id",
          {
            count: "exact",
            head: true
          }
        )
        .eq(
          "shift_name",
          shift.name
        );


    if (usedResult.error) {

      throw usedResult.error;

    }


    if (
      Number(
        usedResult.count || 0
      ) > 0
    ) {

      alert(
        "この勤務形態は勤務表で使用中のため削除できません。\n" +
        "先に勤務表から解除してください。"
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


    if (result.error) {

      throw result.error;

    }


    if (
      String(editingShiftId) ===
      String(shift.id)
    ) {

      editingShiftId = null;

      setShiftButtonText();

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "勤務形態削除エラー",
      error
    );


    alert(
      "勤務形態を削除できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   休業一覧
========================================================= */

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
    function(holiday) {

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
        "list-item-name";


      const start =
        formatJapaneseDate(
          holiday.start_date
        );


      const end =
        formatJapaneseDate(
          holiday.end_date ||
          holiday.start_date
        );


      info.textContent =
        holiday.name +
        "　" +
        start +
        (
          start !== end
            ? " ～ " + end
            : ""
        );


      const buttons =
        document.createElement(
          "div"
        );


      buttons.className =
        "list-item-buttons";


      buttons.appendChild(
        createActionButton(
          "編集",
          "edit",
          function() {

            startEditCompanyHoliday(
              holiday
            );

          }
        )
      );


      buttons.appendChild(
        createActionButton(
          "削除",
          "delete",
          function() {

            deleteCompanyHoliday(
              holiday
            );

          }
        )
      );


      item.appendChild(
        info
      );


      item.appendChild(
        buttons
      );


      list.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   休業追加・更新
========================================================= */

async function addOrUpdateCompanyHoliday() {

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


  if (
    !nameInput ||
    !startInput ||
    !endInput
  ) {

    return;

  }


  const name =
    nameInput.value.trim();


  const start =
    startInput.value;


  const end =
    endInput.value ||
    start;


  if (!name) {

    alert(
      "休業名を入力してください。"
    );

    return;

  }


  if (!start) {

    alert(
      "開始日を入力してください。"
    );

    return;

  }


  if (end < start) {

    alert(
      "終了日は開始日以降にしてください。"
    );

    return;

  }


  setCloudBusy(true);


  try {

    if (
      editingHolidayId !== null
    ) {

      const result =
        await supabaseClient
          .from("company_holidays")
          .update({

            name: name,

            start_date:
              start,

            end_date:
              end

          })
          .eq(
            "id",
            editingHolidayId
          );


      if (result.error) {

        throw result.error;

      }


      alert(
        "休業設定を更新しました。"
      );


    } else {

      const result =
        await supabaseClient
          .from("company_holidays")
          .insert({

            name: name,

            start_date:
              start,

            end_date:
              end

          });


      if (result.error) {

        throw result.error;

      }


      alert(
        "休業日を登録しました。"
      );

    }


    editingHolidayId = null;


    nameInput.value = "";

    startInput.value = "";

    endInput.value = "";


    setHolidayButtonText();


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "休業保存エラー",
      error
    );


    alert(
      "休業設定を保存できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   休業編集
========================================================= */

function startEditCompanyHoliday(
  holiday
) {

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


  if (
    !nameInput ||
    !startInput ||
    !endInput
  ) {

    return;

  }


  editingHolidayId =
    holiday.id;


  nameInput.value =
    holiday.name || "";


  startInput.value =
    String(
      holiday.start_date || ""
    ).slice(0, 10);


  endInput.value =
    String(
      holiday.end_date ||
      holiday.start_date ||
      ""
    ).slice(0, 10);


  setHolidayButtonText();


  nameInput.focus();

}


/* =========================================================
   休業ボタン
========================================================= */

function setHolidayButtonText() {

  const button =
    document.getElementById(
      "addCompanyHolidayButton"
    );


  if (!button) {

    return;

  }


  button.textContent =
    editingHolidayId !== null
      ? "休業設定を更新"
      : "休業を登録";

}


/* =========================================================
   休業削除
========================================================= */

async function deleteCompanyHoliday(
  holiday
) {

  const ok =
    confirm(
      "「" +
      holiday.name +
      "」を削除しますか？"
    );


  if (!ok) {

    return;

  }


  setCloudBusy(true);


  try {

    const result =
      await supabaseClient
        .from("company_holidays")
        .delete()
        .eq(
          "id",
          holiday.id
        );


    if (result.error) {

      throw result.error;

    }


    if (
      String(editingHolidayId) ===
      String(holiday.id)
    ) {

      editingHolidayId = null;

      setHolidayButtonText();

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "休業削除エラー",
      error
    );


    alert(
      "休業設定を削除できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   休暇種類一覧
========================================================= */

function renderLeaveTypeList() {

  const list =
    document.getElementById(
      "leaveTypeList"
    );


  if (!list) {

    return;

  }


  list.innerHTML = "";


  if (
    appData.leaveTypes.length ===
    0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "empty-message";


    empty.textContent =
      "休暇種類が登録されていません。";


    list.appendChild(
      empty
    );


    return;

  }


  appData.leaveTypes.forEach(
    function(leaveType) {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "list-item leave-type-list-item";


      const left =
        document.createElement(
          "div"
        );


      left.className =
        "leave-type-info";


      const color =
        document.createElement(
          "span"
        );


      color.className =
        "leave-color-dot";


      color.style.backgroundColor =
        safeColor(
          leaveType.color,
          "#d9f2df"
        );


      const name =
        document.createElement(
          "span"
        );


      name.className =
        "list-item-name";


      name.textContent =
        leaveType.name;


      left.appendChild(
        color
      );


      left.appendChild(
        name
      );


      const buttons =
        document.createElement(
          "div"
        );


      buttons.className =
        "list-item-buttons";


      const editButton =
        createActionButton(
          "編集",
          "edit",
          function() {

            startEditLeaveType(
              leaveType
            );

          }
        );


      const deleteButton =
        createActionButton(
          "削除",
          "delete",
          function() {

            deleteLeaveType(
              leaveType
            );

          }
        );


      buttons.appendChild(
        editButton
      );


      buttons.appendChild(
        deleteButton
      );


      item.appendChild(
        left
      );


      item.appendChild(
        buttons
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

  console.log(
    "休暇種類ボタン押下"
  );


  const nameInput =
    document.getElementById(
      "leaveTypeNameInput"
    );


  const colorInput =
    document.getElementById(
      "leaveTypeColorInput"
    );


  if (!nameInput) {

    alert(
      "休暇種類名の入力欄が見つかりません。"
    );

    return;

  }


  if (!colorInput) {

    alert(
      "色の入力欄が見つかりません。"
    );

    return;

  }


  const name =
    nameInput.value.trim();


  const color =
    safeColor(
      colorInput.value,
      "#d9f2df"
    );


  if (!name) {

    alert(
      "休暇種類名を入力してください。"
    );

    nameInput.focus();

    return;

  }


  const duplicate =
    appData.leaveTypes.some(
      function(item) {

        return (
          item.name === name &&
          String(item.id) !==
          String(editingLeaveTypeId)
        );

      }
    );


  if (duplicate) {

    alert(
      "同じ休暇種類が登録されています。"
    );

    return;

  }


  if (!supabaseClient) {

    alert(
      "Supabaseに接続されていません。"
    );

    return;

  }


  setCloudBusy(true);


  try {

    /* ===================================================
       更新
    =================================================== */

    if (
      editingLeaveTypeId !== null
    ) {

      const oldLeaveType =
        appData.leaveTypes.find(
          function(item) {

            return String(
              item.id
            ) ===
            String(
              editingLeaveTypeId
            );

          }
        );


      if (!oldLeaveType) {

        throw new Error(
          "編集対象の休暇種類が見つかりません。"
        );

      }


      const oldName =
        oldLeaveType.name;


      /* -----------------------------------------------
         名前変更なら勤務表側も変更
      ------------------------------------------------ */

      if (oldName !== name) {

        const updateAssignments =
          await supabaseClient
            .from("work_shifts")
            .update({

              leave_type:
                name

            })
            .eq(
              "leave_type",
              oldName
            );


        if (
          updateAssignments.error
        ) {

          throw updateAssignments.error;

        }

      }


      const update =
        await supabaseClient
          .from("leave_types")
          .update({

            name: name,

            color: color

          })
          .eq(
            "id",
            editingLeaveTypeId
          );


      if (update.error) {

        /* 名前変更を戻す */

        if (oldName !== name) {

          await supabaseClient
            .from("work_shifts")
            .update({

              leave_type:
                oldName

            })
            .eq(
              "leave_type",
              name
            );

        }


        throw update.error;

      }


      alert(
        "休暇種類を更新しました。"
      );


    } else {

      /* =================================================
         新規追加
      ================================================= */

      const insert =
        await supabaseClient
          .from("leave_types")
          .insert({

            name: name,

            color: color

          });


      if (insert.error) {

        throw insert.error;

      }


      alert(
        "休暇種類を追加しました。"
      );

    }


    editingLeaveTypeId = null;


    nameInput.value = "";

    colorInput.value =
      "#d9f2df";


    setLeaveTypeButtonText();


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "休暇種類保存エラー",
      error
    );


    alert(
      "休暇種類を保存できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   休暇種類編集
========================================================= */

function startEditLeaveType(
  leaveType
) {

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


  editingLeaveTypeId =
    leaveType.id;


  nameInput.value =
    leaveType.name || "";


  colorInput.value =
    normalizeColorInput(
      leaveType.color
    );


  setLeaveTypeButtonText();


  nameInput.focus();

}


/* =========================================================
   休暇種類ボタン
========================================================= */

function setLeaveTypeButtonText() {

  const button =
    document.getElementById(
      "addLeaveTypeButton"
    );


  if (!button) {

    return;

  }


  button.textContent =
    editingLeaveTypeId !== null
      ? "休暇種類を更新"
      : "休暇種類を追加";

}


/* =========================================================
   休暇種類削除
========================================================= */

async function deleteLeaveType(
  leaveType
) {

  const ok =
    confirm(
      "「" +
      leaveType.name +
      "」を削除しますか？"
    );


  if (!ok) {

    return;

  }


  setCloudBusy(true);


  try {

    /* -------------------------------------------------
       使用中か確認
    ------------------------------------------------- */

    const used =
      await supabaseClient
        .from("work_shifts")
        .select(
          "id",
          {
            count: "exact",
            head: true
          }
        )
        .eq(
          "leave_type",
          leaveType.name
        );


    if (used.error) {

      throw used.error;

    }


    if (
      Number(
        used.count || 0
      ) > 0
    ) {

      alert(
        "この休暇種類は勤務表で使用中のため削除できません。\n\n" +
        "先に勤務表から該当する休暇を解除してください。"
      );

      return;

    }


    const result =
      await supabaseClient
        .from("leave_types")
        .delete()
        .eq(
          "id",
          leaveType.id
        );


    if (result.error) {

      throw result.error;

    }


    if (
      String(
        editingLeaveTypeId
      ) ===
      String(
        leaveType.id
      )
    ) {

      editingLeaveTypeId =
        null;

      setLeaveTypeButtonText();

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "休暇種類削除エラー",
      error
    );


    alert(
      "休暇種類を削除できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   明け時間表示
========================================================= */

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


/* =========================================================
   明け時間保存
========================================================= */

async function saveAkeTime() {

  const startInput =
    document.getElementById(
      "akeStartInput"
    );


  const endInput =
    document.getElementById(
      "akeEndInput"
    );


  if (
    !startInput ||
    !endInput
  ) {

    return;

  }


  const start =
    startInput.value;


  const end =
    endInput.value;


  if (!start || !end) {

    alert(
      "開始時間と終了時間を入力してください。"
    );

    return;

  }


  setCloudBusy(true);


  try {

    await saveAppSetting(
      "ake_start",
      start
    );


    await saveAppSetting(
      "ake_end",
      end
    );


    appData.akeTime = {

      start: start,

      end: end

    };


    saveLocalData();


    alert(
      "明け時間を保存しました。"
    );


  } catch (error) {

    console.error(
      "明け時間保存エラー",
      error
    );


    alert(
      "明け時間を保存できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   app_settings保存
========================================================= */

async function saveAppSetting(
  name,
  value
) {

  const find =
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
    find.error &&
    find.error.code !==
    "PGRST116"
  ) {

    throw find.error;

  }


  if (find.data) {

    const update =
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


    if (update.error) {

      throw update.error;

    }


  } else {

    const insert =
      await supabaseClient
        .from("app_settings")
        .insert({

          setting_name:
            name,

          setting_value:
            value

        });


    if (insert.error) {

      throw insert.error;

    }

  }

}


/* =========================================================
   勤務メニュー
========================================================= */

function showShiftMenu(
  cell,
  staffName,
  dateKey
) {

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


  selectedCell = {

    cell: cell,

    staffName:
      staffName,

    dateKey:
      dateKey

  };


  hideLeaveMenu();


  buttons.innerHTML = "";


  /* -----------------------------------------------------
     勤務形態
  ----------------------------------------------------- */

  appData.shiftTypes.forEach(
    function(shift) {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "shift-menu-button";


      button.textContent =
        shift.name;


      button.addEventListener(
        "click",
        function(event) {

          event.stopPropagation();


          saveShiftSelection(
            shift.name
          );

        }
      );


      buttons.appendChild(
        button
      );

    }
  );


  /* -----------------------------------------------------
     削除
  ----------------------------------------------------- */

  const deleteButton =
    document.createElement(
      "button"
    );


  deleteButton.type =
    "button";


  deleteButton.className =
    "shift-menu-button shift-delete";


  deleteButton.textContent =
    "削除";


  deleteButton.addEventListener(
    "click",
    function(event) {

      event.stopPropagation();


      removeSelectedWork();

    }
  );


  buttons.appendChild(
    deleteButton
  );


  /* -----------------------------------------------------
     休暇
  ----------------------------------------------------- */

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
      "shift-menu-button shift-leave";


    leaveButton.textContent =
      "休暇";


    leaveButton.addEventListener(
      "click",
      function(event) {

        event.stopPropagation();


        hideShiftMenu();

        showLeaveMenu(
          cell,
          staffName,
          dateKey
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


  menu.style.display =
    "block";

}


/* =========================================================
   休暇メニュー
========================================================= */

function showLeaveMenu(
  cell,
  staffName,
  dateKey
) {

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


  selectedCell = {

    cell: cell,

    staffName:
      staffName,

    dateKey:
      dateKey

  };


  buttons.innerHTML = "";


  appData.leaveTypes.forEach(
    function(leaveType) {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "shift-menu-button";


      button.textContent =
        leaveType.name;


      button.style.backgroundColor =
        safeColor(
          leaveType.color,
          "#d9f2df"
        );


      button.addEventListener(
        "click",
        function(event) {

          event.stopPropagation();


          saveLeaveSelection(
            leaveType.name
          );

        }
      );


      buttons.appendChild(
        button
      );

    }
  );


  /* -----------------------------------------------------
     休暇解除
  ----------------------------------------------------- */

  const removeButton =
    document.createElement(
      "button"
    );


  removeButton.type =
    "button";


  removeButton.className =
    "shift-menu-button shift-cancel";


  removeButton.textContent =
    "休暇を解除";


  removeButton.addEventListener(
    "click",
    function(event) {

      event.stopPropagation();


      removeSelectedWork();

    }
  );


  buttons.appendChild(
    removeButton
  );


  /* -----------------------------------------------------
     キャンセル
  ----------------------------------------------------- */

  const cancelButton =
    document.createElement(
      "button"
    );


  cancelButton.type =
    "button";


  cancelButton.className =
    "shift-menu-button shift-cancel";


  cancelButton.textContent =
    "キャンセル";


  cancelButton.addEventListener(
    "click",
    function(event) {

      event.stopPropagation();


      hideLeaveMenu();

    }
  );


  buttons.appendChild(
    cancelButton
  );


  leaveMenuOpen = true;


  positionMenu(
    menu,
    cell
  );


  menu.style.display =
    "block";

}


/* =========================================================
   メニュー位置
========================================================= */

function positionMenu(
  menu,
  cell
) {

  menu.style.display =
    "block";


  menu.style.visibility =
    "hidden";


  const rect =
    cell.getBoundingClientRect();


  const menuRect =
    menu.getBoundingClientRect();


  let left =
    rect.left;


  let top =
    rect.bottom + 6;


  if (
    left + menuRect.width >
    window.innerWidth - 8
  ) {

    left =
      window.innerWidth -
      menuRect.width -
      8;

  }


  if (left < 8) {

    left = 8;

  }


  if (
    top + menuRect.height >
    window.innerHeight - 8
  ) {

    top =
      rect.top -
      menuRect.height -
      6;

  }


  if (top < 8) {

    top = 8;

  }


  menu.style.left =
    left + "px";


  menu.style.top =
    top + "px";


  menu.style.visibility =
    "visible";

}


/* =========================================================
   勤務メニュー非表示
========================================================= */

function hideShiftMenu() {

  const menu =
    document.getElementById(
      "shiftMenu"
    );


  if (menu) {

    menu.style.display =
      "none";

  }

}


/* =========================================================
   休暇メニュー非表示
========================================================= */

function hideLeaveMenu() {

  const menu =
    document.getElementById(
      "leaveMenu"
    );


  if (menu) {

    menu.style.display =
      "none";

  }


  leaveMenuOpen = false;

}


/* =========================================================
   勤務登録
========================================================= */

async function saveShiftSelection(
  shiftName
) {

  if (!selectedCell) {

    return;

  }


  const staffName =
    selectedCell.staffName;


  const dateKey =
    selectedCell.dateKey;


  hideShiftMenu();


  setCloudBusy(true);


  try {

    const result =
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


    if (result.error) {

      throw result.error;

    }


    if (!appData.shifts[staffName]) {

      appData.shifts[staffName] = {};

    }


    if (!appData.leaves[staffName]) {

      appData.leaves[staffName] = {};

    }


    appData.shifts[staffName][dateKey] =
      shiftName;


    delete
      appData.leaves[staffName][dateKey];


    saveLocalData();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務登録エラー",
      error
    );


    alert(
      "勤務を登録できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   休暇登録
========================================================= */

async function saveLeaveSelection(
  leaveName
) {

  if (!selectedCell) {

    return;

  }


  const staffName =
    selectedCell.staffName;


  const dateKey =
    selectedCell.dateKey;


  hideLeaveMenu();


  setCloudBusy(true);


  try {

    const result =
      await supabaseClient
        .from("work_shifts")
        .upsert(

          {

            staff_name:
              staffName,

            work_date:
              dateKey,

            shift_name:
              "",

            leave_type:
              leaveName

          },

          {

            onConflict:
              "staff_name,work_date"

          }

        );


    if (result.error) {

      throw result.error;

    }


    if (!appData.shifts[staffName]) {

      appData.shifts[staffName] = {};

    }


    if (!appData.leaves[staffName]) {

      appData.leaves[staffName] = {};

    }


    delete
      appData.shifts[staffName][dateKey];


    appData.leaves[staffName][dateKey] =
      leaveName;


    saveLocalData();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇登録エラー",
      error
    );


    alert(
      "休暇を登録できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   勤務・休暇削除
========================================================= */

async function removeSelectedWork() {

  if (!selectedCell) {

    return;

  }


  const staffName =
    selectedCell.staffName;


  const dateKey =
    selectedCell.dateKey;


  hideShiftMenu();

  hideLeaveMenu();


  setCloudBusy(true);


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
          dateKey
        );


    if (result.error) {

      throw result.error;

    }


    if (appData.shifts[staffName]) {

      delete
        appData.shifts[
          staffName
        ][dateKey];

    }


    if (appData.leaves[staffName]) {

      delete
        appData.leaves[
          staffName
        ][dateKey];

    }


    saveLocalData();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務削除エラー",
      error
    );


    alert(
      "勤務を削除できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   月消去
========================================================= */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth();


  const firstDate =
    formatDateKey(
      new Date(
        year,
        month,
        1
      )
    );


  const lastDate =
    formatDateKey(
      new Date(
        year,
        month + 1,
        0
      )
    );


  const ok =
    confirm(
      year +
      "年" +
      (month + 1) +
      "月の勤務・休暇をすべて削除しますか？"
    );


  if (!ok) {

    return;

  }


  setCloudBusy(true);


  try {

    const result =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .gte(
          "work_date",
          firstDate
        )
        .lte(
          "work_date",
          lastDate
        );


    if (result.error) {

      throw result.error;

    }


    appData.staff.forEach(
      function(staff) {

        if (appData.shifts[staff.name]) {

          removeDatesFromObject(
            appData.shifts[staff.name],
            firstDate,
            lastDate
          );

        }


        if (appData.leaves[staff.name]) {

          removeDatesFromObject(
            appData.leaves[staff.name],
            firstDate,
            lastDate
          );

        }

      }
    );


    saveLocalData();

    renderSchedule();


    alert(
      "月の勤務を削除しました。"
    );


  } catch (error) {

    console.error(
      "月消去エラー",
      error
    );


    alert(
      "月の勤務を削除できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   年度消去
========================================================= */

async function deleteFiscalYear() {

  const fiscal =
    getFiscalYearRange(
      currentDate
    );


  const ok =
    confirm(
      fiscal.year +
      "年度\n" +
      fiscal.start +
      " ～ " +
      fiscal.end +
      "\n\n" +
      "この期間の勤務・休暇をすべて削除しますか？"
    );


  if (!ok) {

    return;

  }


  setCloudBusy(true);


  try {

    const result =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .gte(
          "work_date",
          fiscal.start
        )
        .lte(
          "work_date",
          fiscal.end
        );


    if (result.error) {

      throw result.error;

    }


    appData.staff.forEach(
      function(staff) {

        if (appData.shifts[staff.name]) {

          removeDatesFromObject(
            appData.shifts[staff.name],
            fiscal.start,
            fiscal.end
          );

        }


        if (appData.leaves[staff.name]) {

          removeDatesFromObject(
            appData.leaves[staff.name],
            fiscal.start,
            fiscal.end
          );

        }

      }
    );


    saveLocalData();

    renderSchedule();


    alert(
      fiscal.year +
      "年度の勤務を削除しました。"
    );


  } catch (error) {

    console.error(
      "年度消去エラー",
      error
    );


    alert(
      "年度の勤務を削除できませんでした。\n\n" +
      error.message
    );

  } finally {

    setCloudBusy(false);

  }

}


/* =========================================================
   年度範囲
========================================================= */

function getFiscalYearRange(
  date
) {

  const year =
    date.getFullYear();


  const month =
    date.getMonth();


  let fiscalYear;


  if (month >= 3) {

    fiscalYear =
      year;

  } else {

    fiscalYear =
      year - 1;

  }


  return {

    year:
      fiscalYear,

    start:
      fiscalYear +
      "-04-01",

    end:
      (fiscalYear + 1) +
      "-03-31"

  };

}


/* =========================================================
   日付範囲削除
========================================================= */

function removeDatesFromObject(
  object,
  start,
  end
) {

  Object.keys(object).forEach(
    function(dateKey) {

      if (
        dateKey >= start &&
        dateKey <= end
      ) {

        delete object[dateKey];

      }

    }
  );

}


/* =========================================================
   カレンダーモーダル
========================================================= */

function openCalendarModal(
  staff
) {

  selectedCalendarStaff =
    staff;


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


  if (!modal) {

    return;

  }


  if (title) {

    title.textContent =
      staff.name +
      "さんのカレンダー";

  }


  if (text) {

    text.textContent =
      "現在表示している月の勤務をカレンダー用ファイルとして作成します。";

  }


  modal.style.display =
    "flex";

}


/* =========================================================
   カレンダーモーダル閉じる
========================================================= */

function closeCalendarModal() {

  const modal =
    document.getElementById(
      "calendarConfirm"
    );


  if (modal) {

    modal.style.display =
      "none";

  }


  selectedCalendarStaff =
    null;

}


/* =========================================================
   ICS作成
========================================================= */

function subscribeStaffCalendar() {

  if (!selectedCalendarStaff) {

    return;

  }


  const staff =
    selectedCalendarStaff;


  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth();


  const dates =
    getDaysInMonth(
      year,
      month
    );


  const events = [];


  dates.forEach(
    function(dateKey) {

      const display =
        getDisplayForDate(
          staff.name,
          dateKey
        );


      if (!display.text) {

        return;

      }


      const startDate =
        new Date(
          dateKey + "T00:00:00"
        );


      const nextDate =
        new Date(
          startDate
        );


      nextDate.setDate(
        nextDate.getDate() + 1
      );


      events.push(

        "BEGIN:VEVENT\r\n" +

        "UID:" +
        icsEscape(
          staff.name +
          "-" +
          dateKey +
          "-" +
          Date.now()
        ) +
        "@kinmu-app\r\n" +

        "DTSTART;VALUE=DATE:" +
        dateKey.replaceAll(
          "-",
          ""
        ) +
        "\r\n" +

        "DTEND;VALUE=DATE:" +
        formatDateKey(
          nextDate
        ).replaceAll(
          "-",
          ""
        ) +
        "\r\n" +

        "SUMMARY:" +
        icsEscape(
          display.type === "leave"
            ? "休暇：" +
              display.text
            : "勤務：" +
              display.text
        ) +
        "\r\n" +

        "END:VEVENT\r\n"

      );

    }
  );


  if (events.length === 0) {

    alert(
      "この月には登録されている勤務・休暇がありません。"
    );

    return;

  }


  const ics =
    "BEGIN:VCALENDAR\r\n" +

    "VERSION:2.0\r\n" +

    "PRODID:-//勤務表//JP\r\n" +

    "CALSCALE:GREGORIAN\r\n" +

    "METHOD:PUBLISH\r\n" +

    events.join("") +

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


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    "勤務表_" +
    staff.name +
    "_" +
    year +
    "-" +
    String(
      month + 1
    ).padStart(2, "0") +
    ".ics";


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


  setTimeout(
    function() {

      URL.revokeObjectURL(
        url
      );

    },
    1000
  );


  closeCalendarModal();

}


/* =========================================================
   ICS文字エスケープ
========================================================= */

function icsEscape(
  value
) {

  return String(
    value || ""
  )
    .replaceAll(
      "\\",
      "\\\\"
    )
    .replaceAll(
      ";",
      "\\;"
    )
    .replaceAll(
      ",",
      "\\,"
    )
    .replaceAll(
      "\n",
      "\\n"
    );

}


/* =========================================================
   祝日取得
========================================================= */

async function loadPublicHolidays() {

  try {

    const response =
      await fetch(
        "https://holidays-jp.github.io/api/v1/date.json",
        {
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "祝日データ取得失敗"
      );

    }


    publicHolidays =
      await response.json();


    renderSchedule();


  } catch (error) {

    console.warn(
      "祝日取得エラー",
      error
    );

  }

}


/* =========================================================
   アクションボタン作成
========================================================= */

function createActionButton(
  text,
  type,
  callback
) {

  const button =
    document.createElement(
      "button"
    );


  button.type =
    "button";


  button.className =
    "list-action-button " +
    (
      type === "delete"
        ? "delete-button"
        : "edit-button"
    );


  button.textContent =
    text;


  button.addEventListener(
    "click",
    function(event) {

      event.stopPropagation();

      callback();

    }
  );


  return button;

}


/* =========================================================
   色
========================================================= */

function safeColor(
  color,
  fallback
) {

  const value =
    String(
      color || ""
    ).trim();


  if (
    window.CSS &&
    typeof CSS.supports ===
      "function"
  ) {

    if (
      CSS.supports(
        "color",
        value
      )
    ) {

      return value;

    }

  }


  if (
    /^#[0-9a-fA-F]{6}$/.test(
      value
    )
  ) {

    return value;

  }


  return fallback;

}


/* =========================================================
   color input用
========================================================= */

function normalizeColorInput(
  color
) {

  const value =
    String(
      color || ""
    ).trim();


  if (
    /^#[0-9a-fA-F]{6}$/.test(
      value
    )
  ) {

    return value;

  }


  return "#d9f2df";

}


/* =========================================================
   日本語日付
========================================================= */

function formatJapaneseDate(
  value
) {

  if (!value) {

    return "";

  }


  const text =
    String(value).slice(0, 10);


  const parts =
    text.split("-");


  if (parts.length !== 3) {

    return text;

  }


  return (
    parts[0] +
    "/" +
    Number(parts[1]) +
    "/" +
    Number(parts[2])
  );

}


/* =========================================================
   ランダムトークン
========================================================= */

function createRandomToken() {

  if (
    window.crypto &&
    crypto.randomUUID
  ) {

    return crypto.randomUUID();

  }


  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2)
  );

}


/* =========================================================
   Cloud処理中
========================================================= */

function setCloudBusy(
  value
) {

  cloudOperationBusy =
    value;

}
