/* ============================================================
   勤務表アプリ 完全版 script.js
   ============================================================ */


/* ============================================================
   Supabase
============================================================ */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

let supabaseClient = null;

const STORAGE_KEY =
  "workScheduleAppData";


/* ============================================================
   アプリデータ
============================================================ */

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


/* ============================================================
   状態
============================================================ */

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


let realtimeUpdating = false;

let cloudOperationBusy = false;

let leaveMenuOpen = false;


/* ============================================================
   起動
============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  console.log(
    "================================="
  );

  console.log(
    "★ 勤務表アプリ起動"
  );

  console.log(
    "================================="
  );


  try {

    loadLocalData();

    bindEvents();

    renderAll();


    /* --------------------------------
       Supabase
    -------------------------------- */

    if (
      !window.supabase ||
      typeof window.supabase.createClient !==
        "function"
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
      "★ Supabaseクライアント作成成功"
    );


    try {

      await loadAllFromSupabase();

      renderAll();

      console.log(
        "★ Supabaseデータ取得成功"
      );

    } catch (error) {

      console.error(
        "★ Supabaseデータ取得失敗",
        error
      );

    }


    loadPublicHolidays();

    setupRealtime();

    startAutoSync();

    setupVisibilitySync();


    console.log(
      "★ 勤務表アプリ起動完了"
    );


  } catch (error) {

    console.error(
      "★ 初期化エラー",
      error
    );

    loadLocalData();

    bindEvents();

    renderAll();

    loadPublicHolidays();

  }

}


/* ============================================================
   ローカルデータ読み込み
============================================================ */

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


    if (
      Array.isArray(parsed.staff)
    ) {

      appData.staff =
        parsed.staff;

    }


    if (
      Array.isArray(parsed.shiftTypes)
    ) {

      appData.shiftTypes =
        parsed.shiftTypes;

    }


    if (
      Array.isArray(parsed.leaveTypes)
    ) {

      appData.leaveTypes =
        parsed.leaveTypes;

    }


    if (
      Array.isArray(
        parsed.companyHolidays
      )
    ) {

      appData.companyHolidays =
        parsed.companyHolidays;

    }


    if (
      parsed.shifts &&
      typeof parsed.shifts ===
        "object"
    ) {

      appData.shifts =
        parsed.shifts;

    }


    if (
      parsed.leaves &&
      typeof parsed.leaves ===
        "object"
    ) {

      appData.leaves =
        parsed.leaves;

    }


    if (
      parsed.akeTime &&
      typeof parsed.akeTime ===
        "object"
    ) {

      appData.akeTime = {

        start:
          parsed.akeTime.start ||
          "05:30",

        end:
          parsed.akeTime.end ||
          "11:15"

      };

    }


    console.log(
      "★ ローカルデータ読み込み完了"
    );


  } catch (error) {

    console.error(
      "ローカルデータ読み込みエラー",
      error
    );

  }

}


/* ============================================================
   ローカル保存
============================================================ */

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


/* ============================================================
   Supabaseから全データ読み込み
============================================================ */

async function loadAllFromSupabase() {

  if (!supabaseClient) {

    throw new Error(
      "Supabaseクライアントがありません"
    );

  }


  console.log(
    "========== Supabase読み込み開始 =========="
  );


  /* ========================================================
     職員
  ======================================================== */

  try {

    console.log(
      "★ staff 読み込み開始"
    );


    const result =
      await supabaseClient
        .from("staff")
        .select(
          "id,name,created_at,sort_order,calendar_token"
        );


    if (result.error) {

      throw result.error;

    }


    appData.staff =
      Array.isArray(result.data)
        ? result.data
            .filter(
              row =>
                row.name &&
                row.name !== "明"
            )
            .sort(
              (a, b) => {

                const sortA =
                  Number.isFinite(
                    Number(a.sort_order)
                  )
                    ? Number(a.sort_order)
                    : 999999;


                const sortB =
                  Number.isFinite(
                    Number(b.sort_order)
                  )
                    ? Number(b.sort_order)
                    : 999999;


                if (
                  sortA !== sortB
                ) {

                  return (
                    sortA - sortB
                  );

                }


                const dateA =
                  a.created_at
                    ? new Date(
                        a.created_at
                      ).getTime()
                    : 0;


                const dateB =
                  b.created_at
                    ? new Date(
                        b.created_at
                      ).getTime()
                    : 0;


                return (
                  dateA - dateB
                );

              }
            )
        : [];


    console.log(
      "✅ staff:",
      appData.staff.length,
      "人"
    );


  } catch (error) {

    console.error(
      "❌ staff読み込み失敗",
      error
    );

  }


  /* ========================================================
     勤務形態
  ======================================================== */

  try {

    console.log(
      "★ shift_types 読み込み開始"
    );


    const result =
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


    if (result.error) {

      throw result.error;

    }


    appData.shiftTypes =
      Array.isArray(result.data)
        ? result.data.filter(
            row =>
              row.name &&
              row.name !== "明"
          )
        : [];


    console.log(
      "✅ shift_types:",
      appData.shiftTypes.length,
      "件"
    );


  } catch (error) {

    console.error(
      "❌ shift_types読み込み失敗",
      error
    );

  }


  /* ========================================================
     休暇種類
  ======================================================== */

  try {

    console.log(
      "★ leave_types 読み込み開始"
    );


    const result =
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


    if (result.error) {

      throw result.error;

    }


    appData.leaveTypes =
      Array.isArray(result.data)
        ? result.data
        : [];


    console.log(
      "✅ leave_types:",
      appData.leaveTypes.length,
      "件"
    );


  } catch (error) {

    console.error(
      "❌ leave_types読み込み失敗",
      error
    );

    appData.leaveTypes = [];

  }


  /* ========================================================
     勤務データ
  ======================================================== */

  try {

    console.log(
      "★ work_shifts 読み込み開始"
    );


    const result =
      await supabaseClient
        .from("work_shifts")
        .select(
          "id,staff_name,work_date,shift_name,leave_type"
        );


    if (result.error) {

      throw result.error;

    }


    appData.shifts = {};

    appData.leaves = {};


    if (
      Array.isArray(result.data)
    ) {

      result.data.forEach(
        row => {

          if (!row.staff_name) {

            return;

          }


          if (!row.work_date) {

            return;

          }


          if (
            !appData.shifts[
              row.staff_name
            ]
          ) {

            appData.shifts[
              row.staff_name
            ] = {};

          }


          if (
            !appData.leaves[
              row.staff_name
            ]
          ) {

            appData.leaves[
              row.staff_name
            ] = {};

          }


          if (
            row.leave_type &&
            String(
              row.leave_type
            ).trim() !== ""
          ) {

            appData.leaves[
              row.staff_name
            ][
              row.work_date
            ] =
              row.leave_type;


            delete appData.shifts[
              row.staff_name
            ][
              row.work_date
            ];


            return;

          }


          if (
            row.shift_name &&
            String(
              row.shift_name
            ).trim() !== ""
          ) {

            appData.shifts[
              row.staff_name
            ][
              row.work_date
            ] =
              row.shift_name;

          }

        }
      );

    }


    console.log(
      "✅ work_shifts:",
      Array.isArray(result.data)
        ? result.data.length
        : 0,
      "件"
    );


  } catch (error) {

    console.error(
      "❌ work_shifts読み込み失敗",
      error
    );

  }


  /* ========================================================
     会社休業
  ======================================================== */

  try {

    console.log(
      "★ company_holidays 読み込み開始"
    );


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

      throw result.error;

    }


    appData.companyHolidays =
      Array.isArray(result.data)
        ? result.data
        : [];


    console.log(
      "✅ company_holidays:",
      appData.companyHolidays.length,
      "件"
    );


  } catch (error) {

    console.error(
      "❌ company_holidays読み込み失敗",
      error
    );

  }


  /* ========================================================
     アプリ設定
  ======================================================== */

  try {

    console.log(
      "★ app_settings 読み込み開始"
    );


    const result =
      await supabaseClient
        .from("app_settings")
        .select(
          "setting_name,setting_value"
        );


    if (result.error) {

      throw result.error;

    }


    let akeStart =
      "05:30";

    let akeEnd =
      "11:15";


    if (
      Array.isArray(result.data)
    ) {

      const startRow =
        result.data.find(
          row =>
            row.setting_name ===
            "ake_start"
        );


      const endRow =
        result.data.find(
          row =>
            row.setting_name ===
            "ake_end"
        );


      if (
        startRow &&
        startRow.setting_value
      ) {

        akeStart =
          startRow.setting_value;

      }


      if (
        endRow &&
        endRow.setting_value
      ) {

        akeEnd =
          endRow.setting_value;

      }

    }


    appData.akeTime = {

      start: akeStart,

      end: akeEnd

    };


    console.log(
      "✅ app_settings:",
      appData.akeTime
    );


  } catch (error) {

    console.error(
      "❌ app_settings読み込み失敗",
      error
    );

  }


  saveLocalData();


  console.log(
    "========== Supabase読み込み終了 =========="
  );

}


/* ============================================================
   Realtime
============================================================ */

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

    realtimeChannel = null;

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

        payload => {

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

        payload => {

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

        payload => {

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

        payload => {

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

        payload => {

          console.log(
            "Realtime leave_types",
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
          table: "app_settings"
        },

        payload => {

          console.log(
            "Realtime app_settings",
            payload
          );

          scheduleRealtimeReload();

        }

      )


      .subscribe(

        status => {

          console.log(
            "Supabase Realtime STATUS:",
            status
          );


          if (
            status === "SUBSCRIBED"
          ) {

            console.log(
              "★ Supabase Realtime接続成功"
            );

          }


          if (
            status ===
              "CHANNEL_ERROR" ||
            status ===
              "TIMED_OUT" ||
            status ===
              "CLOSED"
          ) {

            console.error(
              "★ Supabase Realtime接続エラー"
            );


            setTimeout(
              () => {

                if (
                  document.visibilityState ===
                  "visible"
                ) {

                  setupRealtime();

                }

              },
              3000
            );

          }

        }

      );

}


/* ============================================================
   Realtime再読み込み
============================================================ */

function scheduleRealtimeReload() {

  clearTimeout(
    realtimeReloadTimer
  );


  realtimeReloadTimer =

    setTimeout(
      async () => {

        await reloadFromSupabase();

      },
      300
    );

}


async function reloadFromSupabase() {

  if (!supabaseClient) {

    return;

  }


  if (cloudOperationBusy) {

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
      "自動更新エラー",
      error
    );

  } finally {

    realtimeUpdating = false;

  }

}


/* ============================================================
   自動同期
============================================================ */

function startAutoSync() {

  clearInterval(
    autoSyncTimer
  );


  autoSyncTimer =

    setInterval(
      async () => {

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


/* ============================================================
   画面復帰時同期
============================================================ */

function setupVisibilitySync() {

  document.addEventListener(
    "visibilitychange",
    async () => {

      if (
        document.visibilityState ===
        "visible"
      ) {

        await reloadFromSupabase();

      }

    }
  );

}


/* ============================================================
   イベント
============================================================ */

function bindEvents() {


  /* --------------------------------
     ナビゲーション
  -------------------------------- */

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


  /* --------------------------------
     月移動
  -------------------------------- */

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


  /* --------------------------------
     職員
  -------------------------------- */

  const addStaff =
    document.getElementById(
      "addStaffButton"
    );


  if (addStaff) {

    addStaff.addEventListener(
      "click",
      addOrUpdateStaff
    );

  }


  /* --------------------------------
     勤務形態
  -------------------------------- */

  const addShift =
    document.getElementById(
      "addShiftButton"
    );


  if (addShift) {

    addShift.addEventListener(
      "click",
      addOrUpdateShift
    );

  }


  /* --------------------------------
     休業
  -------------------------------- */

  const addHoliday =
    document.getElementById(
      "addCompanyHolidayButton"
    );


  if (addHoliday) {

    addHoliday.addEventListener(
      "click",
      addOrUpdateCompanyHoliday
    );

  }


  /* --------------------------------
     明け時間
  -------------------------------- */

  const saveAke =
    document.getElementById(
      "saveAkeTimeButton"
    );


  if (saveAke) {

    saveAke.addEventListener(
      "click",
      saveAkeTime
    );

  }


  /* --------------------------------
     休暇種類
  -------------------------------- */

  const addLeaveType =
    document.getElementById(
      "addLeaveTypeButton"
    );


  if (addLeaveType) {

    addLeaveType.addEventListener(
      "click",
      addOrUpdateLeaveType
    );

  }


  /* --------------------------------
     カレンダー
  -------------------------------- */

  const calendarCancel =
    document.getElementById(
      "calendarCancelButton"
    );


  if (calendarCancel) {

    calendarCancel.addEventListener(
      "click",
      closeCalendarModal
    );

  }


  const calendarOK =
    document.getElementById(
      "calendarOKButton"
    );


  if (calendarOK) {

    calendarOK.addEventListener(
      "click",
      subscribeStaffCalendar
    );

  }


  /* --------------------------------
     月消去
  -------------------------------- */

  const deleteMonth =
    document.getElementById(
      "deleteMonthButton"
    );


  if (deleteMonth) {

    deleteMonth.addEventListener(
      "click",
      deleteCurrentMonth
    );

  }


  /* --------------------------------
     年度消去
  -------------------------------- */

  const deleteYear =
    document.getElementById(
      "deleteFiscalYearButton"
    );


  if (deleteYear) {

    deleteYear.addEventListener(
      "click",
      deleteFiscalYear
    );

  }


  /* --------------------------------
     勤務表クリック
  -------------------------------- */

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (table) {

    table.addEventListener(
      "click",
      handleScheduleTableClick
    );

  }


  /* --------------------------------
     外側クリック
  -------------------------------- */

  document.addEventListener(
    "click",
    event => {

      const target =
        event.target;


      if (
        target.closest(
          "#shiftMenu"
        ) ||
        target.closest(
          "#leaveMenu"
        )
      ) {

        return;

      }


      if (
        target.closest(
          ".shift-cell"
        )
      ) {

        return;

      }


      if (
        target.closest(
          ".staff-cell"
        )
      ) {

        return;

      }


      hideShiftMenu();

      hideLeaveMenu();

    }
  );


  /* --------------------------------
     Esc
  -------------------------------- */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        hideShiftMenu();

        hideLeaveMenu();

      }

    }
  );

}


/* ============================================================
   ページ表示
============================================================ */

function showPage(pageName) {

  const pages =
    document.querySelectorAll(
      ".page"
    );


  pages.forEach(
    page => {

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
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
            pageName
        );

      }
    );


  hideShiftMenu();

  hideLeaveMenu();


  if (
    pageName === "schedule"
  ) {

    renderSchedule();

  }


  if (
    pageName === "staff"
  ) {

    renderStaffList();

  }


  if (
    pageName === "shift"
  ) {

    renderShiftList();

    renderAkeTime();

  }


  if (
    pageName === "holiday"
  ) {

    renderCompanyHolidayList();

  }


  if (
    pageName === "leaveType"
  ) {

    renderLeaveTypeList();

  }

}


/* ============================================================
   全画面描画
============================================================ */

function renderAll() {

  renderSchedule();

  renderStaffList();

  renderShiftList();

  renderCompanyHolidayList();

  renderLeaveTypeList();

  renderAkeTime();

}


/* ============================================================
   勤務表描画
============================================================ */

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
      `${year}年${month + 1}月`;

  }


  table.innerHTML = "";


  const days =
    getDaysInCurrentMonth();


  /* ========================================================
     THEAD
  ======================================================== */

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


  staffHeader.textContent =
    "職員";


  staffHeader.className =
    "staff-header";


  headerRow.appendChild(
    staffHeader
  );


  days.forEach(
    date => {

      const th =
        document.createElement(
          "th"
        );


      th.className =
        "date-header";


      const dateKey =
        formatDateKey(date);


      th.dataset.date =
        dateKey;


      const day =
        date.getDay();


      if (day === 0) {

        th.classList.add(
          "sunday"
        );

      }


      if (day === 6) {

        th.classList.add(
          "saturday"
        );

      }


      if (
        publicHolidays[
          dateKey
        ]
      ) {

        th.classList.add(
          "holiday"
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


      const dayNumber =
        document.createElement(
          "div"
        );


      dayNumber.className =
        "date-number";


      dayNumber.textContent =
        date.getDate();


      const dayName =
        document.createElement(
          "div"
        );


      dayName.className =
        "date-weekday";


      dayName.textContent =
        getDayName(day);


      th.appendChild(
        dayNumber
      );


      th.appendChild(
        dayName
      );


      headerRow.appendChild(
        th
      );

    }
  );


  /* --------------------------------
     勤務数ヘッダー
  -------------------------------- */

  appData.shiftTypes.forEach(
    shift => {

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


  /* ========================================================
     TBODY
  ======================================================== */

  const tbody =
    document.createElement(
      "tbody"
    );


  appData.staff.forEach(
    (staff, staffIndex) => {

      const tr =
        document.createElement(
          "tr"
        );


      const staffCell =
        document.createElement(
          "th"
        );


      staffCell.className =
        "staff-cell";


      staffCell.textContent =
        staff.name;


      staffCell.title =
        "タップしてカレンダーへ";


      staffCell.dataset.staffIndex =
        staffIndex;


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


      let totalCount = 0;


      days.forEach(
        date => {

          const dateKey =
            formatDateKey(date);


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


          const day =
            date.getDay();


          if (day === 0) {

            td.classList.add(
              "sunday"
            );

          }


          if (day === 6) {

            td.classList.add(
              "saturday"
            );

          }


          if (
            publicHolidays[
              dateKey
            ]
          ) {

            td.classList.add(
              "holiday"
            );

            td.title =
              publicHolidays[
                dateKey
              ];

          }


          if (
            isCompanyHoliday(
              dateKey
            )
          ) {

            td.classList.add(
              "company-holiday"
            );

            const holiday =
              getCompanyHoliday(
                dateKey
              );


            if (holiday) {

              td.title =
                holiday.name;

            }

          }


          const display =
            getDisplayForDate(
              staff.name,
              dateKey
            );


          if (
            display.type ===
            "leave"
          ) {

            td.classList.add(
              "leave-cell"
            );


            td.textContent =
              display.text;


            td.style.backgroundColor =
              safeColor(
                display.color
              );


            td.style.color =
              "#1d1d1f";


            td.title =
              display.text;

          } else {

            td.textContent =
              display.text;


            if (
              display.type ===
              "shift"
            ) {

              if (
                countMap[
                  display.text
                ] !== undefined
              ) {

                countMap[
                  display.text
                ]++;

              }


              totalCount++;

            }

          }


          tr.appendChild(
            td
          );

        }
      );


      /* --------------------------------
         勤務別合計
      -------------------------------- */

      appData.shiftTypes.forEach(
        shift => {

          const td =
            document.createElement(
              "td"
            );


          td.className =
            "total-cell";


          td.textContent =
            countMap[
              shift.name
            ] || 0;


          tr.appendChild(
            td
          );

        }
      );


      /* --------------------------------
         合計
      -------------------------------- */

      const totalCell =
        document.createElement(
          "td"
        );


      totalCell.className =
        "total-cell";


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


/* ============================================================
   勤務表クリック
============================================================ */

function handleScheduleTableClick(
  event
) {

  const staffCell =
    event.target.closest(
      ".staff-cell"
    );


  if (staffCell) {

    if (leaveMenuOpen) {

      hideLeaveMenu();

      return;

    }


    const index =
      Number(
        staffCell.dataset.staffIndex
      );


    const staff =
      appData.staff[index];


    if (staff) {

      openCalendarModal(
        staff
      );

    }


    return;

  }


  const cell =
    event.target.closest(
      ".shift-cell"
    );


  if (!cell) {

    return;

  }


  const staffName =
    cell.dataset.staff;


  const dateKey =
    cell.dataset.date;


  if (!staffName || !dateKey) {

    return;

  }


  /* --------------------------------
     休暇メニュー表示中なら
     別セルをタップしても
     勤務メニューを開かない
  -------------------------------- */

  if (leaveMenuOpen) {

    hideLeaveMenu();

    return;

  }


  showShiftMenu(
    cell,
    staffName,
    dateKey
  );

}


/* ============================================================
   表示する勤務
============================================================ */

function getDisplayForDate(
  staffName,
  dateKey
) {

  const staffLeaves =
    appData.leaves[
      staffName
    ] || {};


  const leaveName =
    staffLeaves[
      dateKey
    ];


  if (leaveName) {

    const leaveType =
      findLeaveType(
        leaveName
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


  const staffShifts =
    appData.shifts[
      staffName
    ] || {};


  const explicitShift =
    staffShifts[
      dateKey
    ];


  if (explicitShift) {

    return {

      type: "shift",

      text: explicitShift

    };

  }


  const previousDate =
    addDaysToDateKey(
      dateKey,
      -1
    );


  const previousShift =
    staffShifts[
      previousDate
    ];


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


  return {

    type: "",

    text: ""

  };

}


/* ============================================================
   明け判定
============================================================ */

function isAkeShift(
  shiftName
) {

  if (!shiftName) {

    return false;

  }


  const name =
    String(
      shiftName
    );


  return (
    name.includes("宿") ||
    name.includes("夜")
  );

}


/* ============================================================
   勤務メニュー
============================================================ */

function showShiftMenu(
  cell,
  staffName,
  dateKey
) {

  if (leaveMenuOpen) {

    return;

  }


  const menu =
    document.getElementById(
      "shiftMenu"
    );


  const buttons =
    document.getElementById(
      "shiftMenuButtons"
    );


  if (!menu || !buttons) {

    return;

  }


  selectedCell = {

    cell,

    staffName,

    dateKey

  };


  buttons.innerHTML =
    "";


  /* --------------------------------
     勤務形態
  -------------------------------- */

  appData.shiftTypes.forEach(
    shift => {

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
        event => {

          event.stopPropagation();

          saveShiftAssignment(
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


  /* --------------------------------
     削除
  -------------------------------- */

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
    event => {

      event.stopPropagation();

      deleteShiftAssignment(
        staffName,
        dateKey
      );

    }
  );


  buttons.appendChild(
    deleteButton
  );


  /* --------------------------------
     休暇
  -------------------------------- */

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
      "shift-menu-button shift-leave";


    leaveButton.textContent =
      "休暇";


    leaveButton.addEventListener(
      "click",
      event => {

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

}


/* ============================================================
   休暇メニュー
============================================================ */

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


  if (!menu || !buttons) {

    return;

  }


  selectedCell = {

    cell,

    staffName,

    dateKey

  };


  buttons.innerHTML =
    "";


  leaveMenuOpen =
    true;


  /* --------------------------------
     休暇種類
  -------------------------------- */

  appData.leaveTypes.forEach(
    leaveType => {

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
          leaveType.color
        );


      button.style.color =
        "#1d1d1f";


      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          saveLeaveAssignment(
            staffName,
            dateKey,
            leaveType.name
          );

        }
      );


      buttons.appendChild(
        button
      );

    }
  );


  /* --------------------------------
     休暇解除
  -------------------------------- */

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
    event => {

      event.stopPropagation();

      removeLeaveAssignment(
        staffName,
        dateKey
      );

    }
  );


  buttons.appendChild(
    removeButton
  );


  /* --------------------------------
     キャンセル
  -------------------------------- */

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
    event => {

      event.stopPropagation();

      hideLeaveMenu();

    }
  );


  buttons.appendChild(
    cancelButton
  );


  positionMenu(
    menu,
    cell
  );

}


/* ============================================================
   メニュー位置
============================================================ */

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
    top + menuRect.height >
    window.innerHeight - 10
  ) {

    top =
      rect.top -
      menuRect.height -
      6;

  }


  if (
    left + menuRect.width >
    window.innerWidth - 10
  ) {

    left =
      window.innerWidth -
      menuRect.width -
      10;

  }


  if (left < 10) {

    left = 10;

  }


  if (top < 10) {

    top = 10;

  }


  menu.style.left =
    `${left}px`;


  menu.style.top =
    `${top}px`;


  menu.style.visibility =
    "visible";

}


/* ============================================================
   勤務メニュー非表示
============================================================ */

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


/* ============================================================
   休暇メニュー非表示
============================================================ */

function hideLeaveMenu() {

  const menu =
    document.getElementById(
      "leaveMenu"
    );


  if (menu) {

    menu.style.display =
      "none";

  }


  leaveMenuOpen =
    false;

}


/* ============================================================
   勤務登録
============================================================ */

async function saveShiftAssignment(
  staffName,
  dateKey,
  shiftName
) {

  hideShiftMenu();

  hideLeaveMenu();


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


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
    ][
      dateKey
    ] =
      shiftName;


    delete appData.leaves[
      staffName
    ][
      dateKey
    ];


    saveLocalData();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務登録エラー",
      error
    );


    alert(
      "勤務を登録できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   休暇登録
============================================================ */

async function saveLeaveAssignment(
  staffName,
  dateKey,
  leaveName
) {

  hideLeaveMenu();

  hideShiftMenu();


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


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
    ][
      dateKey
    ] =
      leaveName;


    delete appData.shifts[
      staffName
    ][
      dateKey
    ];


    saveLocalData();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇登録エラー",
      error
    );


    alert(
      "休暇を登録できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   勤務削除
============================================================ */

async function deleteShiftAssignment(
  staffName,
  dateKey
) {

  hideShiftMenu();

  hideLeaveMenu();


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


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


    if (
      appData.shifts[
        staffName
      ]
    ) {

      delete appData.shifts[
        staffName
      ][
        dateKey
      ];

    }


    if (
      appData.leaves[
        staffName
      ]
    ) {

      delete appData.leaves[
        staffName
      ][
        dateKey
      ];

    }


    saveLocalData();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務削除エラー",
      error
    );


    alert(
      "勤務を削除できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   休暇解除
============================================================ */

async function removeLeaveAssignment(
  staffName,
  dateKey
) {

  await deleteShiftAssignment(
    staffName,
    dateKey
  );

}


/* ============================================================
   職員一覧
============================================================ */

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


  list.innerHTML =
    "";


  if (count) {

    count.textContent =
      `${appData.staff.length}人`;

  }


  appData.staff.forEach(
    (staff, index) => {

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


      const edit =
        document.createElement(
          "button"
        );


      edit.type =
        "button";


      edit.className =
        "small-button";


      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () => {

          startEditStaff(
            index
          );

        }
      );


      const del =
        document.createElement(
          "button"
        );


      del.type =
        "button";


      del.className =
        "small-button danger";


      del.textContent =
        "削除";


      del.addEventListener(
        "click",
        () => {

          deleteStaff(
            index
          );

        }
      );


      buttons.appendChild(
        edit
      );


      buttons.appendChild(
        del
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


/* ============================================================
   職員追加・更新
============================================================ */

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
      (staff, index) =>
        staff.name === name &&
        index !== editingStaffIndex
    );


  if (duplicate) {

    alert(
      "同じ職員名が登録されています。"
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

  } else {

    await insertStaff(
      name
    );

  }

}


/* ============================================================
   職員追加
============================================================ */

async function insertStaff(
  name
) {

  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const nextOrder =
      appData.staff.length;


    const result =
      await supabaseClient
        .from("staff")
        .insert({

          name:

            name,

          sort_order:

            nextOrder,

          calendar_token:

            createToken()

        })
        .select()
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.staff.push(
      result.data
    );


    saveLocalData();

    resetStaffForm();

    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "職員追加エラー",
      error
    );


    alert(
      "職員を追加できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   職員編集開始
============================================================ */

function startEditStaff(
  index
) {

  const staff =
    appData.staff[index];


  if (!staff) {

    return;

  }


  const input =
    document.getElementById(
      "staffNameInput"
    );


  const button =
    document.getElementById(
      "addStaffButton"
    );


  if (input) {

    input.value =
      staff.name;

    input.focus();

  }


  if (button) {

    button.textContent =
      "職員を更新";

  }


  editingStaffIndex =
    index;

}


/* ============================================================
   職員更新
============================================================ */

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


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (
      oldName !== newName
    ) {

      const shiftUpdate =
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


      if (
        shiftUpdate.error
      ) {

        throw shiftUpdate.error;

      }

    }


    const result =
      await supabaseClient
        .from("staff")
        .update({
          name:
            newName
        })
        .eq(
          "id",
          staff.id
        );


    if (result.error) {

      if (
        oldName !== newName
      ) {

        await supabaseClient
          .from("work_shifts")
          .update({
            staff_name:
              oldName
          })
          .eq(
            "staff_name",
            newName
          );

      }

      throw result.error;

    }


    if (
      oldName !== newName
    ) {

      appData.shifts[
        newName
      ] =
        appData.shifts[
          oldName
        ] || {};


      appData.leaves[
        newName
      ] =
        appData.leaves[
          oldName
        ] || {};


      delete appData.shifts[
        oldName
      ];


      delete appData.leaves[
        oldName
      ];

    }


    staff.name =
      newName;


    saveLocalData();

    resetStaffForm();

    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "職員更新エラー",
      error
    );


    alert(
      "職員を更新できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   職員削除
============================================================ */

async function deleteStaff(
  index
) {

  const staff =
    appData.staff[index];


  if (!staff) {

    return;

  }


  const ok =
    confirm(
      `${staff.name}さんを削除しますか？\n勤務データも削除されます。`
    );


  if (!ok) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const shiftDelete =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "staff_name",
          staff.name
        );


    if (
      shiftDelete.error
    ) {

      throw shiftDelete.error;

    }


    const staffDelete =
      await supabaseClient
        .from("staff")
        .delete()
        .eq(
          "id",
          staff.id
        );


    if (
      staffDelete.error
    ) {

      throw staffDelete.error;

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


    saveLocalData();

    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "職員削除エラー",
      error
    );


    alert(
      "職員を削除できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   職員フォームリセット
============================================================ */

function resetStaffForm() {

  const input =
    document.getElementById(
      "staffNameInput"
    );


  const button =
    document.getElementById(
      "addStaffButton"
    );


  if (input) {

    input.value =
      "";

  }


  if (button) {

    button.textContent =
      "追加";

  }


  editingStaffIndex =
    -1;

}


/* ============================================================
   勤務形態一覧
============================================================ */

function renderShiftList() {

  const list =
    document.getElementById(
      "shiftList"
    );


  if (!list) {

    return;

  }


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
        "list-item-main";


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


      const start =
        shift.start_time ||
        "";


      const end =
        shift.end_time ||
        "";


      const breakTime =
        shift.break_time !==
          null &&
        shift.break_time !==
          undefined
          ? shift.break_time
          : 0;


      detail.textContent =
        `${start} ～ ${end}　休憩 ${breakTime}分`;


      info.appendChild(
        name
      );


      info.appendChild(
        detail
      );


      const buttons =
        document.createElement(
          "div"
        );


      buttons.className =
        "list-item-buttons";


      const edit =
        document.createElement(
          "button"
        );


      edit.type =
        "button";


      edit.className =
        "small-button";


      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () => {

          startEditShift(
            index
          );

        }
      );


      const del =
        document.createElement(
          "button"
        );


      del.type =
        "button";


      del.className =
        "small-button danger";


      del.textContent =
        "削除";


      del.addEventListener(
        "click",
        () => {

          deleteShiftType(
            index
          );

        }
      );


      buttons.appendChild(
        edit
      );


      buttons.appendChild(
        del
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


/* ============================================================
   勤務形態追加・更新
============================================================ */

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
    Number(
      breakInput.value || 0
    );


  if (!name) {

    alert(
      "勤務形態名を入力してください。"
    );

    return;

  }


  if (name === "明") {

    alert(
      "「明」は自動表示されるため登録できません。"
    );

    return;

  }


  if (!start || !end) {

    alert(
      "開始時間と終了時間を入力してください。"
    );

    return;

  }


  if (
    breakTime < 0
  ) {

    alert(
      "休憩時間を確認してください。"
    );

    return;

  }


  const duplicate =
    appData.shiftTypes.some(
      (shift, index) =>
        shift.name === name &&
        index !== editingShiftIndex
    );


  if (duplicate) {

    alert(
      "同じ勤務形態名が登録されています。"
    );

    return;

  }


  if (
    editingShiftIndex >= 0
  ) {

    await updateShiftType(
      editingShiftIndex,
      name,
      start,
      end,
      breakTime
    );

  } else {

    await insertShiftType(
      name,
      start,
      end,
      breakTime
    );

  }

}


/* ============================================================
   勤務形態追加
============================================================ */

async function insertShiftType(
  name,
  start,
  end,
  breakTime
) {

  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("shift_types")
        .insert({

          name:
            name,

          start_time:
            start,

          end_time:
            end,

          break_time:
            breakTime

        })
        .select()
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.shiftTypes.push(
      result.data
    );


    saveLocalData();

    resetShiftForm();

    renderShiftList();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務形態追加エラー",
      error
    );


    alert(
      "勤務形態を追加できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   勤務形態編集開始
============================================================ */

function startEditShift(
  index
) {

  const shift =
    appData.shiftTypes[index];


  if (!shift) {

    return;

  }


  const name =
    document.getElementById(
      "shiftNameInput"
    );


  const start =
    document.getElementById(
      "shiftStartInput"
    );


  const end =
    document.getElementById(
      "shiftEndInput"
    );


  const breakInput =
    document.getElementById(
      "shiftBreakInput"
    );


  const button =
    document.getElementById(
      "addShiftButton"
    );


  if (name) {

    name.value =
      shift.name;

  }


  if (start) {

    start.value =
      shift.start_time || "";

  }


  if (end) {

    end.value =
      shift.end_time || "";

  }


  if (breakInput) {

    breakInput.value =
      shift.break_time || 0;

  }


  if (button) {

    button.textContent =
      "勤務形態を更新";

  }


  editingShiftIndex =
    index;

}


/* ============================================================
   勤務形態更新
============================================================ */

async function updateShiftType(
  index,
  name,
  start,
  end,
  breakTime
) {

  const shift =
    appData.shiftTypes[index];


  if (!shift) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("shift_types")
        .update({

          name:
            name,

          start_time:
            start,

          end_time:
            end,

          break_time:
            breakTime

        })
        .eq(
          "id",
          shift.id
        );


    if (result.error) {

      throw result.error;

    }


    shift.name =
      name;

    shift.start_time =
      start;

    shift.end_time =
      end;

    shift.break_time =
      breakTime;


    saveLocalData();

    resetShiftForm();

    renderShiftList();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務形態更新エラー",
      error
    );


    alert(
      "勤務形態を更新できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   勤務形態削除
============================================================ */

async function deleteShiftType(
  index
) {

  const shift =
    appData.shiftTypes[index];


  if (!shift) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  const ok =
    confirm(
      `「${shift.name}」を削除しますか？`
    );


  if (!ok) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const countResult =
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


    if (
      countResult.error
    ) {

      throw countResult.error;

    }


    if (
      Number(
        countResult.count || 0
      ) > 0
    ) {

      alert(
        "この勤務形態は勤務表で使用中のため削除できません。\n先に勤務表から解除してください。"
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


    appData.shiftTypes.splice(
      index,
      1
    );


    saveLocalData();

    renderShiftList();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務形態削除エラー",
      error
    );


    alert(
      "勤務形態を削除できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   勤務形態フォームリセット
============================================================ */

function resetShiftForm() {

  const name =
    document.getElementById(
      "shiftNameInput"
    );


  const start =
    document.getElementById(
      "shiftStartInput"
    );


  const end =
    document.getElementById(
      "shiftEndInput"
    );


  const breakInput =
    document.getElementById(
      "shiftBreakInput"
    );


  const button =
    document.getElementById(
      "addShiftButton"
    );


  if (name) {

    name.value =
      "";

  }


  if (start) {

    start.value =
      "";

  }


  if (end) {

    end.value =
      "";

  }


  if (breakInput) {

    breakInput.value =
      "";

  }


  if (button) {

    button.textContent =
      "勤務形態を追加";

  }


  editingShiftIndex =
    -1;

}


/* ============================================================
   休暇種類一覧
============================================================ */

function renderLeaveTypeList() {

  const list =
    document.getElementById(
      "leaveTypeList"
    );


  if (!list) {

    return;

  }


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
        "list-item-main";


      const nameRow =
        document.createElement(
          "div"
        );


      nameRow.className =
        "leave-type-name-row";


      const dot =
        document.createElement(
          "span"
        );


      dot.className =
        "leave-color-dot";


      dot.style.backgroundColor =
        safeColor(
          leaveType.color
        );


      const name =
        document.createElement(
          "div"
        );


      name.className =
        "list-item-name";


      name.textContent =
        leaveType.name;


      nameRow.appendChild(
        dot
      );


      nameRow.appendChild(
        name
      );


      info.appendChild(
        nameRow
      );


      const buttons =
        document.createElement(
          "div"
        );


      buttons.className =
        "list-item-buttons";


      const edit =
        document.createElement(
          "button"
        );


      edit.type =
        "button";


      edit.className =
        "small-button";


      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () => {

          startEditLeaveType(
            leaveType.id
          );

        }
      );


      const del =
        document.createElement(
          "button"
        );


      del.type =
        "button";


      del.className =
        "small-button danger";


      del.textContent =
        "削除";


      del.addEventListener(
        "click",
        () => {

          deleteLeaveType(
            leaveType.id
          );

        }
      );


      buttons.appendChild(
        edit
      );


      buttons.appendChild(
        del
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


/* ============================================================
   休暇種類追加・更新
============================================================ */

async function addOrUpdateLeaveType() {

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
    editingLeaveTypeId !==
    null
  ) {

    await updateLeaveType(
      editingLeaveTypeId,
      name,
      color
    );

  } else {

    await insertLeaveType(
      name,
      color
    );

  }

}


/* ============================================================
   休暇種類追加
============================================================ */

async function insertLeaveType(
  name,
  color
) {

  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const duplicate =
      appData.leaveTypes.some(
        leave =>
          leave.name === name
      );


    if (duplicate) {

      alert(
        "同じ休暇種類が登録されています。"
      );

      return;

    }


    const result =
      await supabaseClient
        .from("leave_types")
        .insert({

          name:
            name,

          color:
            color

        })
        .select()
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.leaveTypes.push(
      result.data
    );


    saveLocalData();

    resetLeaveTypeForm();

    renderLeaveTypeList();


  } catch (error) {

    console.error(
      "休暇種類追加エラー",
      error
    );


    alert(
      "休暇種類を追加できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   休暇種類編集開始
============================================================ */

function startEditLeaveType(
  id
) {

  const leaveType =
    appData.leaveTypes.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!leaveType) {

    return;

  }


  const nameInput =
    document.getElementById(
      "leaveTypeNameInput"
    );


  const colorInput =
    document.getElementById(
      "leaveTypeColorInput"
    );


  const button =
    document.getElementById(
      "addLeaveTypeButton"
    );


  if (nameInput) {

    nameInput.value =
      leaveType.name;

  }


  if (colorInput) {

    colorInput.value =
      safeColor(
        leaveType.color,
        "#d9f2df"
      );

  }


  if (button) {

    button.textContent =
      "休暇種類を更新";

  }


  editingLeaveTypeId =
    id;

}


/* ============================================================
   休暇種類更新
============================================================ */

async function updateLeaveType(
  id,
  newName,
  newColor
) {

  const leaveType =
    appData.leaveTypes.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!leaveType) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  const oldName =
    leaveType.name;


  const duplicate =
    appData.leaveTypes.some(
      item =>
        String(item.id) !==
          String(id) &&
        item.name === newName
    );


  if (duplicate) {

    alert(
      "同じ休暇種類名が登録されています。"
    );

    return;

  }


  cloudOperationBusy =
    true;


  try {

    /* --------------------------------
       名前変更の場合、
       勤務表側の文字も変更
    -------------------------------- */

    if (
      oldName !== newName
    ) {

      const assignmentUpdate =
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


      if (
        assignmentUpdate.error
      ) {

        throw assignmentUpdate.error;

      }

    }


    const result =
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


    if (result.error) {

      if (
        oldName !== newName
      ) {

        await supabaseClient
          .from("work_shifts")
          .update({

            leave_type:
              oldName

          })
          .eq(
            "leave_type",
            newName
          );

      }

      throw result.error;

    }


    /* --------------------------------
       ローカル更新
    -------------------------------- */

    if (
      oldName !== newName
    ) {

      Object.keys(
        appData.leaves
      ).forEach(
        staffName => {

          const dates =
            appData.leaves[
              staffName
            ] || {};


          Object.keys(
            dates
          ).forEach(
            dateKey => {

              if (
                dates[
                  dateKey
                ] === oldName
              ) {

                dates[
                  dateKey
                ] =
                  newName;

              }

            }
          );

        }
      );

    }


    leaveType.name =
      newName;


    leaveType.color =
      newColor;


    saveLocalData();

    resetLeaveTypeForm();

    renderLeaveTypeList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇種類更新エラー",
      error
    );


    alert(
      "休暇種類を更新できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   休暇種類削除
============================================================ */

async function deleteLeaveType(
  id
) {

  const leaveType =
    appData.leaveTypes.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!leaveType) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  const ok =
    confirm(
      `「${leaveType.name}」を削除しますか？`
    );


  if (!ok) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const countResult =
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


    if (
      countResult.error
    ) {

      throw countResult.error;

    }


    if (
      Number(
        countResult.count || 0
      ) > 0
    ) {

      alert(
        "この休暇種類は勤務表で使用中のため削除できません。\n先に勤務表から解除してください。"
      );

      return;

    }


    const result =
      await supabaseClient
        .from("leave_types")
        .delete()
        .eq(
          "id",
          id
        );


    if (result.error) {

      throw result.error;

    }


    appData.leaveTypes =
      appData.leaveTypes.filter(
        item =>
          String(item.id) !==
          String(id)
      );


    saveLocalData();

    renderLeaveTypeList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇種類削除エラー",
      error
    );


    alert(
      "休暇種類を削除できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   休暇種類フォームリセット
============================================================ */

function resetLeaveTypeForm() {

  const nameInput =
    document.getElementById(
      "leaveTypeNameInput"
    );


  const colorInput =
    document.getElementById(
      "leaveTypeColorInput"
    );


  const button =
    document.getElementById(
      "addLeaveTypeButton"
    );


  if (nameInput) {

    nameInput.value =
      "";

  }


  if (colorInput) {

    colorInput.value =
      "#d9f2df";

  }


  if (button) {

    button.textContent =
      "休暇種類を追加";

  }


  editingLeaveTypeId =
    null;

}


/* ============================================================
   休業一覧
============================================================ */

function renderCompanyHolidayList() {

  const list =
    document.getElementById(
      "companyHolidayList"
    );


  if (!list) {

    return;

  }


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
        "list-item-main";


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


      const end =
        holiday.end_date ||
        holiday.start_date;


      detail.textContent =
        holiday.start_date ===
        end
          ? holiday.start_date
          : `${holiday.start_date} ～ ${end}`;


      info.appendChild(
        name
      );


      info.appendChild(
        detail
      );


      const buttons =
        document.createElement(
          "div"
        );


      buttons.className =
        "list-item-buttons";


      const edit =
        document.createElement(
          "button"
        );


      edit.type =
        "button";


      edit.className =
        "small-button";


      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () => {

          startEditCompanyHoliday(
            holiday.id
          );

        }
      );


      const del =
        document.createElement(
          "button"
        );


      del.type =
        "button";


      del.className =
        "small-button danger";


      del.textContent =
        "削除";


      del.addEventListener(
        "click",
        () => {

          deleteCompanyHoliday(
            holiday.id
          );

        }
      );


      buttons.appendChild(
        edit
      );


      buttons.appendChild(
        del
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


/* ============================================================
   休業追加・更新
============================================================ */

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


  if (
    end < start
  ) {

    alert(
      "終了日は開始日以降にしてください。"
    );

    return;

  }


  if (
    editingHolidayId !==
    null
  ) {

    await updateCompanyHoliday(
      editingHolidayId,
      name,
      start,
      end
    );

  } else {

    await insertCompanyHoliday(
      name,
      start,
      end
    );

  }

}


/* ============================================================
   休業追加
============================================================ */

async function insertCompanyHoliday(
  name,
  start,
  end
) {

  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("company_holidays")
        .insert({

          name:
            name,

          start_date:
            start,

          end_date:
            end

        })
        .select()
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.companyHolidays.push(
      result.data
    );


    saveLocalData();

    resetHolidayForm();

    renderCompanyHolidayList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休業追加エラー",
      error
    );


    alert(
      "休業を登録できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   休業編集開始
============================================================ */

function startEditCompanyHoliday(
  id
) {

  const holiday =
    appData.companyHolidays.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!holiday) {

    return;

  }


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


  const button =
    document.getElementById(
      "addCompanyHolidayButton"
    );


  if (nameInput) {

    nameInput.value =
      holiday.name;

  }


  if (startInput) {

    startInput.value =
      holiday.start_date;

  }


  if (endInput) {

    endInput.value =
      holiday.end_date ||
      holiday.start_date;

  }


  if (button) {

    button.textContent =
      "休業を更新";

  }


  editingHolidayId =
    id;

}


/* ============================================================
   休業更新
============================================================ */

async function updateCompanyHoliday(
  id,
  name,
  start,
  end
) {

  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("company_holidays")
        .update({

          name:
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


    if (result.error) {

      throw result.error;

    }


    const holiday =
      appData.companyHolidays.find(
        item =>
          String(item.id) ===
          String(id)
      );


    if (holiday) {

      holiday.name =
        name;

      holiday.start_date =
        start;

      holiday.end_date =
        end;

    }


    saveLocalData();

    resetHolidayForm();

    renderCompanyHolidayList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休業更新エラー",
      error
    );


    alert(
      "休業を更新できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   休業削除
============================================================ */

async function deleteCompanyHoliday(
  id
) {

  const holiday =
    appData.companyHolidays.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!holiday) {

    return;

  }


  const ok =
    confirm(
      `「${holiday.name}」を削除しますか？`
    );


  if (!ok) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("company_holidays")
        .delete()
        .eq(
          "id",
          id
        );


    if (result.error) {

      throw result.error;

    }


    appData.companyHolidays =
      appData.companyHolidays.filter(
        item =>
          String(item.id) !==
          String(id)
      );


    saveLocalData();

    renderCompanyHolidayList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休業削除エラー",
      error
    );


    alert(
      "休業を削除できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   休業フォームリセット
============================================================ */

function resetHolidayForm() {

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


  const button =
    document.getElementById(
      "addCompanyHolidayButton"
    );


  if (nameInput) {

    nameInput.value =
      "";

  }


  if (startInput) {

    startInput.value =
      "";

  }


  if (endInput) {

    endInput.value =
      "";

  }


  if (button) {

    button.textContent =
      "休業を登録";

  }


  editingHolidayId =
    null;

}


/* ============================================================
   明け時間表示
============================================================ */

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
      appData.akeTime.start ||
      "05:30";

  }


  if (end) {

    end.value =
      appData.akeTime.end ||
      "11:15";

  }

}


/* ============================================================
   明け時間保存
============================================================ */

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


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


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

      start:
        start,

      end:
        end

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
      "明け時間を保存できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   アプリ設定保存
============================================================ */

async function saveAppSetting(
  name,
  value
) {

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


  if (existing.error) {

    throw existing.error;

  }


  if (existing.data) {

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


    if (result.error) {

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


    if (result.error) {

      throw result.error;

    }

  }

}


/* ============================================================
   月消去
============================================================ */

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


  const ok =
    confirm(
      `${year}年${month + 1}月の勤務をすべて削除しますか？`
    );


  if (!ok) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

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


    if (result.error) {

      throw result.error;

    }


    appData.staff.forEach(
      staff => {

        if (
          appData.shifts[
            staff.name
          ]
        ) {

          removeDatesFromObject(
            appData.shifts[
              staff.name
            ],
            start,
            end
          );

        }


        if (
          appData.leaves[
            staff.name
          ]
        ) {

          removeDatesFromObject(
            appData.leaves[
              staff.name
            ],
            start,
            end
          );

        }

      }
    );


    saveLocalData();

    renderSchedule();


    alert(
      `${year}年${month + 1}月の勤務を削除しました。`
    );


  } catch (error) {

    console.error(
      "月消去エラー",
      error
    );


    alert(
      "月の勤務を削除できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   年度消去
============================================================ */

async function deleteFiscalYear() {

  const year =
    currentDate.getFullYear();


  let fiscalStartYear;


  if (
    currentDate.getMonth() >=
    3
  ) {

    fiscalStartYear =
      year;

  } else {

    fiscalStartYear =
      year - 1;

  }


  const start =
    `${fiscalStartYear}-04-01`;


  const end =
    `${fiscalStartYear + 1}-03-31`;


  const fiscalText =
    `${fiscalStartYear}年度`;


  const ok =
    confirm(
      `${fiscalText}の勤務をすべて削除しますか？`
    );


  if (!ok) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

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


    if (result.error) {

      throw result.error;

    }


    appData.staff.forEach(
      staff => {

        if (
          appData.shifts[
            staff.name
          ]
        ) {

          removeDatesFromObject(
            appData.shifts[
              staff.name
            ],
            start,
            end
          );

        }


        if (
          appData.leaves[
            staff.name
          ]
        ) {

          removeDatesFromObject(
            appData.leaves[
              staff.name
            ],
            start,
            end
          );

        }

      }
    );


    saveLocalData();

    renderSchedule();


    alert(
      `${fiscalText}の勤務を削除しました。`
    );


  } catch (error) {

    console.error(
      "年度消去エラー",
      error
    );


    alert(
      "年度の勤務を削除できませんでした。\n" +
      error.message
    );


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ============================================================
   カレンダー確認
============================================================ */

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
      `${staff.name}さん`;

  }


  if (text) {

    text.textContent =
      "現在表示している月の勤務をカレンダー用ファイルにします。";

  }


  modal.style.display =
    "flex";

}


/* ============================================================
   カレンダーモーダル閉じる
============================================================ */

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


/* ============================================================
   カレンダー出力
============================================================ */

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


  const days =
    getDaysInCurrentMonth();


  const events = [];


  days.forEach(
    date => {

      const dateKey =
        formatDateKey(date);


      const display =
        getDisplayForDate(
          staff.name,
          dateKey
        );


      if (!display.text) {

        return;

      }


      const nextDay =
        new Date(date);


      nextDay.setDate(
        nextDay.getDate() + 1
      );


      const start =
        dateKey.replace(
          /-/g,
          ""
        );


      const end =
        formatDateKey(
          nextDay
        ).replace(
          /-/g,
          ""
        );


      let summary;


      if (
        display.type ===
        "leave"
      ) {

        summary =
          `休暇：${display.text}`;

      } else {

        summary =
          `勤務：${display.text}`;

      }


      events.push({

        start,

        end,

        summary

      });

    }
  );


  if (events.length === 0) {

    alert(
      "この月には登録されている勤務がありません。"
    );

    closeCalendarModal();

    return;

  }


  const lines = [

    "BEGIN:VCALENDAR",

    "VERSION:2.0",

    "PRODID:-//勤務表//JP",

    "CALSCALE:GREGORIAN",

    "METHOD:PUBLISH"

  ];


  events.forEach(
    event => {

      lines.push(
        "BEGIN:VEVENT"
      );


      lines.push(
        `UID:${createToken()}@kinmu-app`
      );


      lines.push(
        `DTSTART;VALUE=DATE:${event.start}`
      );


      lines.push(
        `DTEND;VALUE=DATE:${event.end}`
      );


      lines.push(
        `SUMMARY:${icsEscape(event.summary)}`
      );


      lines.push(
        "END:VEVENT"
      );

    }
  );


  lines.push(
    "END:VCALENDAR"
  );


  const blob =
    new Blob(
      [
        "\uFEFF" +
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


  const anchor =
    document.createElement(
      "a"
    );


  anchor.href =
    url;


  anchor.download =
    `勤務表_${staff.name}_${year}-${String(
      month + 1
    ).padStart(
      2,
      "0"
    )}.ics`;


  document.body.appendChild(
    anchor
  );


  anchor.click();


  anchor.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    1000
  );


  closeCalendarModal();

}


/* ============================================================
   国民の祝日
============================================================ */

async function loadPublicHolidays() {

  try {

    const response =
      await fetch(
        "https://holidays-jp.github.io/api/v1/date.json",
        {
          cache:
            "no-store"
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
      "祝日データ取得エラー",
      error
    );

  }

}


/* ============================================================
   会社休業判定
============================================================ */

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


/* ============================================================
   会社休業取得
============================================================ */

function getCompanyHoliday(
  dateKey
) {

  return (
    appData.companyHolidays.find(
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
    ) || null
  );

}


/* ============================================================
   休暇種類取得
============================================================ */

function findLeaveType(
  name
) {

  return (
    appData.leaveTypes.find(
      item =>
        item.name === name
    ) || null
  );

}


/* ============================================================
   日付一覧
============================================================ */

function getDaysInCurrentMonth() {

  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth();


  const count =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const days = [];


  for (
    let day = 1;
    day <= count;
    day++
  ) {

    days.push(
      new Date(
        year,
        month,
        day
      )
    );

  }


  return days;

}


/* ============================================================
   日付キー
============================================================ */

function formatDateKey(
  date
) {

  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return (
    `${year}-${month}-${day}`
  );

}


/* ============================================================
   日付キーに日数を加算
============================================================ */

function addDaysToDateKey(
  dateKey,
  amount
) {

  const parts =
    dateKey.split("-")
      .map(Number);


  const date =
    new Date(
      parts[0],
      parts[1] - 1,
      parts[2]
    );


  date.setDate(
    date.getDate() + amount
  );


  return formatDateKey(
    date
  );

}


/* ============================================================
   曜日
============================================================ */

function getDayName(
  day
) {

  const names = [

    "日",

    "月",

    "火",

    "水",

    "木",

    "金",

    "土"

  ];


  return names[day] || "";

}


/* ============================================================
   オブジェクトから期間削除
============================================================ */

function removeDatesFromObject(
  object,
  start,
  end
) {

  Object.keys(
    object
  ).forEach(
    dateKey => {

      if (
        dateKey >= start &&
        dateKey <= end
      ) {

        delete object[
          dateKey
        ];

      }

    }
  );

}


/* ============================================================
   色の安全確認
============================================================ */

function safeColor(
  color,
  fallback = "#d9f2df"
) {

  const value =
    String(
      color || ""
    ).trim();


  try {

    if (
      window.CSS &&
      typeof window.CSS.supports ===
        "function"
    ) {

      if (
        window.CSS.supports(
          "color",
          value
        )
      ) {

        return value;

      }

    }

  } catch (error) {

    console.warn(
      "色判定エラー",
      error
    );

  }


  return fallback;

}


/* ============================================================
   トークン作成
============================================================ */

function createToken() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {

    return window.crypto.randomUUID();

  }


  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .substring(2, 12)
  );

}


/* ============================================================
   ICSエスケープ
============================================================ */

function icsEscape(
  text
) {

  return String(
    text || ""
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
      /\r?\n/g,
      "\\n"
    );

}


/* ============================================================
   ウィンドウサイズ変更時
============================================================ */

window.addEventListener(
  "resize",
  () => {

    hideShiftMenu();

    hideLeaveMenu();

  }
);


/* ============================================================
   スクロール時
============================================================ */

window.addEventListener(
  "scroll",
  () => {

    hideShiftMenu();

    hideLeaveMenu();

  },
  true
);


/* ============================================================
   アプリ終了時ローカル保存
============================================================ */

window.addEventListener(
  "beforeunload",
  () => {

    saveLocalData();

  }
);


/* ============================================================
   END
============================================================ */
