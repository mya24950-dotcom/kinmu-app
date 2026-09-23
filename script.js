/* ==================================================
   Supabase
================================================== */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

let supabaseClient = null;


/* ==================================================
   ローカル保存
================================================== */

const STORAGE_KEY =
  "workScheduleAppData";


/* ==================================================
   アプリデータ
================================================== */

let appData = {
  staff: [],
  shiftTypes: [],
  leaveTypes: [],
  companyHolidays: [],
  shifts: {},
  leaves: {},
  akeTime: { start: "05:30", end: "11:15" }
};


let currentDate = new Date();

currentDate.setDate(1);


let editingStaffIndex = -1;

let editingShiftIndex = -1;

let editingHolidayId = null;

let selectedCell = null;

let publicHolidays = {};


/* ==================================================
   同期管理
================================================== */

let realtimeChannel = null;

let realtimeReloadTimer = null;

let autoSyncTimer = null;

let realtimeUpdating = false;

let cloudOperationBusy = false;


/* ==================================================
   初期化
================================================== */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  try {

    console.log(
      "★ 勤務表アプリ起動"
    );


    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {

      throw new Error(
        "Supabaseライブラリが読み込まれていません"
      );

    }


    console.log(
      "★ Supabase JS読み込み成功"
    );


    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );


    console.log(
      "★ Supabaseクライアント作成成功"
    );


    loadLocalData();


    bindEvents();


    try {

      await loadAllFromSupabase();

      console.log(
        "★ Supabaseデータ取得成功"
      );

    } catch (error) {

      console.error(
        "★ Supabaseデータ取得失敗",
        error
      );

      alert(
        "Supabaseからデータを取得できませんでした。\n現在の画面を表示します。"
      );

    }


    renderAll();


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


    alert(
      "Supabaseへの接続に失敗しました。\nアプリ自体は起動します。"
    );

  }

}


/* ==================================================
   ローカルデータ
================================================== */

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


    appData.companyHolidays =
      Array.isArray(
        parsed.companyHolidays
      )
        ? parsed.companyHolidays
        : [];


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


  } catch (error) {

    console.error(
      "ローカルデータ読み込みエラー",
      error
    );

  }

}


/* ==================================================
   ローカル設定保存
================================================== */

function saveLocalData() {

  try {

    localStorage.setItem(

      STORAGE_KEY,

      JSON.stringify({

        companyHolidays:
          appData.companyHolidays,

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


/* ==================================================
   Supabaseから全データ取得
================================================== */

async function loadAllFromSupabase() {

  if (!supabaseClient) {
    return;
  }

  try {

    const [
      staffResult,
      shiftResult,
      workResult,
      holidayResult,
      settingsResult,
      leaveTypeResult
    ] = await Promise.all([

      // 職員
      supabaseClient
        .from("staff")
        .select(
          "id,name,created_at,sort_order,calendar_token"
        ),

      // 勤務形態
      supabaseClient
        .from("shift_types")
        .select(
          "id,name,created_at,start_time,end_time,break_time"
        )
        .order(
          "created_at",
          { ascending: true }
        ),

      // 勤務・休暇
      supabaseClient
        .from("work_shifts")
        .select(
          "id,staff_name,work_date,shift_name,leave_type"
        ),

      // 会社休日
      supabaseClient
        .from("company_holidays")
        .select(
          "id,name,start_date,end_date,created_at"
        )
        .order(
          "start_date",
          { ascending: true }
        ),

      // アプリ設定
      supabaseClient
        .from("app_settings")
        .select(
          "setting_name,setting_value"
        ),

      // 休暇種類
      supabaseClient
        .from("leave_types")
        .select(
          "id,name,color,created_at"
        )
        .order(
          "created_at",
          { ascending: true }
        )

    ]);


    // ==========================================
    // エラーチェック
    // ==========================================

    if (staffResult.error) {
      throw staffResult.error;
    }

    if (shiftResult.error) {
      throw shiftResult.error;
    }

    if (workResult.error) {
      throw workResult.error;
    }

    if (holidayResult.error) {
      throw holidayResult.error;
    }

    if (settingsResult.error) {
      throw settingsResult.error;
    }

    if (leaveTypeResult.error) {
      throw leaveTypeResult.error;
    }


    // ==========================================
    // 職員
    // ==========================================

    appData.staff = (staffResult.data || [])
      .map(row => ({
        id: row.id,
        name: row.name,
        created_at: row.created_at,
        sort_order:
          row.sort_order ?? 999999,
        calendar_token:
          row.calendar_token || ""
      }))
      .sort((a, b) => {

        if (
          a.sort_order !==
          b.sort_order
        ) {
          return (
            a.sort_order -
            b.sort_order
          );
        }

        return String(a.name || "")
          .localeCompare(
            String(b.name || ""),
            "ja"
          );

      });


    // ==========================================
    // 勤務形態
    // ==========================================

    appData.shiftTypes =
      (shiftResult.data || [])
        .map(row => ({
          id: row.id,
          name: row.name,
          created_at: row.created_at,
          start_time:
            row.start_time || "",
          end_time:
            row.end_time || "",
          break_time:
            row.break_time || ""
        }));


    // ==========================================
    // 休暇種類
    // ==========================================

    appData.leaveTypes =
      (leaveTypeResult.data || [])
        .map(row => ({
          id: row.id,
          name: row.name,
          color:
            row.color ||
            "#d9f2df",
          created_at:
            row.created_at
        }));


    // ==========================================
    // 勤務・休暇データを初期化
    // ==========================================

    appData.shifts = {};
    appData.leaves = {};


    appData.staff.forEach(staff => {

      appData.shifts[staff.name] = {};
      appData.leaves[staff.name] = {};

    });


    // ==========================================
    // 勤務・休暇データを読み込み
    // ==========================================

    (workResult.data || [])
      .forEach(row => {

        if (
          !row.staff_name ||
          !row.work_date
        ) {
          return;
        }


        // 職員が存在しない場合
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


        // 勤務
        if (row.shift_name) {

          appData.shifts[
            row.staff_name
          ][row.work_date] =
            row.shift_name;

        }


        // 休暇
        if (row.leave_type) {

          appData.leaves[
            row.staff_name
          ][row.work_date] =
            row.leave_type;

        }

      });


    // ==========================================
    // 会社休日
    // ==========================================

    appData.companyHolidays =
      (holidayResult.data || [])
        .map(row => ({
          id: row.id,
          name: row.name,
          start_date:
            row.start_date,
          end_date:
            row.end_date,
          created_at:
            row.created_at
        }))
        .sort((a, b) =>
          String(a.start_date || "")
            .localeCompare(
              String(b.start_date || "")
            )
        );


    // ==========================================
    // アプリ設定
    // ==========================================

    const settings =
      settingsResult.data || [];


    const akeSetting =
      settings.find(
        row =>
          row.setting_name ===
          "akeTime"
      );


    if (akeSetting) {

      try {

        const parsed =
          JSON.parse(
            akeSetting.setting_value
          );

        if (
          parsed &&
          parsed.start &&
          parsed.end
        ) {

          appData.akeTime = {
            start: parsed.start,
            end: parsed.end
          };

        }

      } catch (e) {

        console.warn(
          "akeTime設定の読み込みに失敗:",
          e
        );

      }

    }


    saveLocalData();


  } catch (error) {

    console.error(
      "Supabaseデータ読み込みエラー:",
      error
    );

    throw error;

  }

}

function getStoredLeave(staffName, dateKey) {

  const name = getStaffName(staffName);

  if (!appData.leaves[name]) {
    return "";
  }

  return (
    appData.leaves[name][dateKey] ||
    ""
  );

}

function setStoredLeave(
  staffName,
  dateKey,
  leaveType
) {

  const name = getStaffName(staffName);

  if (!appData.leaves[name]) {
    appData.leaves[name] = {};
  }

  if (leaveType) {

    appData.leaves[name][dateKey] =
      leaveType;

  } else {

    delete appData.leaves[name][dateKey];

  }

}

/* ==================================================
   Realtime
================================================== */

function setupRealtime() {

  if (!supabaseClient) {

    console.error(
      "Supabaseクライアントがありません"
    );

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
            "Realtime staff:",
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
            "Realtime work_shifts:",
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
            "Realtime shift_types:",
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
            "Realtime company_holidays:",
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
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {

            console.error(
              "★ Supabase Realtime接続が切れました"
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


/* ==================================================
   Realtime更新予約
================================================== */

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


/* ==================================================
   Supabase再読み込み
================================================== */

async function reloadFromSupabase() {

  if (!supabaseClient) {

    return;

  }


  if (cloudOperationBusy) {

    console.log(
      "★ 保存処理中のため自動同期をスキップ"
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


    console.log(
      "★ 勤務表を自動更新しました"
    );


  } catch (error) {

    console.error(
      "自動更新エラー",
      error
    );

  } finally {

    realtimeUpdating = false;

  }

}


/* ==================================================
   10秒自動同期
================================================== */

function startAutoSync() {

  if (autoSyncTimer) {

    clearInterval(
      autoSyncTimer
    );

  }


  autoSyncTimer =

    setInterval(

      async () => {

        if (!supabaseClient) {

          return;

        }


        if (cloudOperationBusy) {

          return;

        }


        if (
          document.visibilityState !==
          "visible"
        ) {

          return;

        }


        await reloadFromSupabase();

      },

      10000

    );


  console.log(
    "★ 自動同期開始（10秒）"
  );

}


/* ==================================================
   アプリ復帰時同期
================================================== */

function setupVisibilitySync() {

  document.addEventListener(
    "visibilitychange",
    async () => {

      if (
        document.visibilityState !==
        "visible"
      ) {

        return;

      }


      console.log(
        "★ アプリ復帰 → Supabase同期"
      );


      setTimeout(
        async () => {

          await reloadFromSupabase();

          setupRealtime();

        },
        300
      );

    }
  );

}


/* ==================================================
   イベント
================================================== */

function bindEvents() {

  document
    .querySelectorAll(
      ".nav-button"
    )
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


  const addHoliday =
    document.getElementById(
      "addCompanyHolidayButton"
    );


  if (addHoliday) {

    addHoliday.addEventListener(
      "click",
      addCompanyHoliday
    );

  }


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


  const deleteFiscal =
    document.getElementById(
      "deleteFiscalYearButton"
    );


  if (deleteFiscal) {

    deleteFiscal.addEventListener(
      "click",
      deleteFiscalYear
    );

  }


  document.addEventListener(
    "click",
    e => {

      const menu =
        document.getElementById(
          "shiftMenu"
        );


      if (!menu) {

        return;

      }


      if (
        !menu.contains(e.target) &&
        !e.target.closest(
          ".schedule-cell"
        )
      ) {

        hideShiftMenu();

      }

    }
  );

}


/* ==================================================
   ページ切り替え
================================================== */

function showPage(page) {

  document
    .querySelectorAll(".page")
    .forEach(p => {

      p.style.display =
        "none";

    });


  const target =
    document.getElementById(
      page + "Page"
    );


  if (target) {

    target.style.display =
      "";

  }


  document
    .querySelectorAll(".nav-button")
    .forEach(button => {

      button.classList.toggle(

        "active",

        button.dataset.page ===
          page

      );

    });


  hideShiftMenu();


  if (page === "schedule") {

    renderSchedule();

  }


  if (page === "staff") {

    renderStaffList();

  }


  if (page === "shift") {

    renderShiftList();

  }


  if (page === "holiday") {

    renderHolidayList();

  }

}


/* ==================================================
   全体描画
================================================== */

function renderAll() {

  renderSchedule();

  renderStaffList();

  renderShiftList();

  renderHolidayList();


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


/* ==================================================
   日付
================================================== */

function getDateKey(
  year,
  month,
  day
) {

  return (

    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  );

}


function getDaysInMonth(
  year,
  month
) {

  return new Date(
    year,
    month,
    0
  ).getDate();

}


function formatDateJP(
  dateKey
) {

  const [
    y,
    m,
    d
  ] =
    dateKey
      .split("-")
      .map(Number);


  return `${y}/${m}/${d}`;

}


/* ==================================================
   休業・祝日
================================================== */

function isCompanyHoliday(
  dateKey
) {

  return appData.companyHolidays.some(
    h =>
      dateKey >= h.start &&
      dateKey <= h.end
  );

}


function getCompanyHoliday(
  dateKey
) {

  return appData.companyHolidays.find(
    h =>
      dateKey >= h.start &&
      dateKey <= h.end
  );

}


function isPublicHoliday(
  dateKey
) {

  return !!publicHolidays[
    dateKey
  ];

}


/* ==================================================
   勤務表示
================================================== */

function getStoredShift(
  staffName,
  dateKey
) {

  const name =
    getStaffName(
      staffName
    );


  if (
    !appData.shifts[name]
  ) {

    return "";

  }


  return (

    appData.shifts[name][dateKey] ||
    ""

  );

}


function setStoredShift(
  staffName,
  dateKey,
  shiftName
) {

  const name =
    getStaffName(
      staffName
    );


  if (
    !appData.shifts[name]
  ) {

    appData.shifts[name] = {};

  }


  if (shiftName) {

    appData.shifts[name][dateKey] =
      shiftName;

  } else {

    delete appData.shifts[name][dateKey];

  }

}


/* ==================================================
   職員名
================================================== */

function getStaffName(
  staff
) {

  if (
    typeof staff === "string"
  ) {

    return staff;

  }


  if (
    staff &&
    typeof staff === "object" &&
    staff.name
  ) {

    return String(
      staff.name
    );

  }


  return String(
    staff ?? ""
  );

}


/* ==================================================
   自動「明」
================================================== */

function getDisplayShift(
  staffName,
  dateKey
) {

  // ==========================================
  // まず休暇を確認
  // ==========================================

  const leave =
    getStoredLeave(
      staffName,
      dateKey
    );

  if (leave) {
    return leave;
  }


  // ==========================================
  // 通常勤務
  // ==========================================

  const shift =
    getStoredShift(
      staffName,
      dateKey
    );

  if (!shift) {
    return "";
  }


  // ==========================================
  // 前日の勤務を確認して「明」を自動表示
  // ==========================================

  const current =
    new Date(dateKey + "T00:00:00");

  current.setDate(
    current.getDate() - 1
  );


  const previousDateKey =
    getDateKey(
      current.getFullYear(),
      current.getMonth(),
      current.getDate()
    );


  const previousShift =
    getStoredShift(
      staffName,
      previousDateKey
    );


  if (
    previousShift &&
    (
      previousShift.includes("宿") ||
      previousShift.includes("夜")
    )
  ) {

    return "明";

  }


  return shift;

}

/* ==================================================
   勤務表
================================================== */

function renderSchedule() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  const monthLabel =
    document.getElementById(
      "currentMonth"
    );


  if (!table) {

    return;

  }


  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth() + 1;


  const days =
    getDaysInMonth(
      year,
      month
    );


  if (monthLabel) {

    monthLabel.textContent =
      `${year}年${month}月`;

  }


  const staffColumnWidth =
    90;


  const dateColumnWidth =
    window.innerWidth <= 600
      ? 48
      : 52;


  const totalColumnWidth =
    window.innerWidth <= 600
      ? 52
      : 58;


  let html = "";


  html +=
    "<colgroup>";


  html += `

    <col
      class="staff-column"
      style="
        width:${staffColumnWidth}px;
        min-width:${staffColumnWidth}px;
        max-width:${staffColumnWidth}px;
      "
    >

  `;


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    html += `

      <col
        class="date-column"
        style="
          width:${dateColumnWidth}px;
          min-width:${dateColumnWidth}px;
          max-width:${dateColumnWidth}px;
        "
      >

    `;

  }


  appData.shiftTypes.forEach(
    () => {

      html += `

        <col
          class="total-column"
          style="
            width:${totalColumnWidth}px;
            min-width:${totalColumnWidth}px;
            max-width:${totalColumnWidth}px;
          "
        >

        <col
          class="total-column"
          style="
            width:${totalColumnWidth}px;
            min-width:${totalColumnWidth}px;
            max-width:${totalColumnWidth}px;
          "
        >

      `;

    }
  );


  html +=
    "</colgroup>";


  html +=
    "<thead>";


  html +=
    "<tr>";


  html += `

    <th
      class="staff-header"
      rowspan="2"
      style="
        width:${staffColumnWidth}px;
        min-width:${staffColumnWidth}px;
        max-width:${staffColumnWidth}px;
        position:sticky;
        left:0;
        z-index:100;
        background:#f2f2f7;
        box-sizing:border-box;
      "
    >
      職員
    </th>

  `;


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const dateKey =
      getDateKey(
        year,
        month,
        day
      );


    const week =
      new Date(
        year,
        month - 1,
        day
      ).getDay();


    let cls =
      "date-header";


    if (
      isCompanyHoliday(
        dateKey
      )
    ) {

      cls +=
        " company-holiday";

    } else if (

      week === 0 ||

      isPublicHoliday(
        dateKey
      )

    ) {

      cls +=
        " sunday";

    } else if (
      week === 6
    ) {

      cls +=
        " saturday";

    }


    html += `

      <th
        class="${cls}"
        rowspan="2"
        style="
          width:${dateColumnWidth}px;
          min-width:${dateColumnWidth}px;
          max-width:${dateColumnWidth}px;
          box-sizing:border-box;
        "
      >

        <span class="day-number">
          ${day}
        </span>

        <br>

        <span class="day-week">

          ${
            [
              "日",
              "月",
              "火",
              "水",
              "木",
              "金",
              "土"
            ][week]
          }

        </span>

      </th>

    `;

  }


  appData.shiftTypes.forEach(
    shift => {

      html += `

        <th
          colspan="2"
          class="shift-header"
        >

          ${escapeHtml(
            shift.name
          )}

        </th>

      `;

    }
  );


  html +=
    "</tr>";


  html +=
    "<tr>";


  appData.shiftTypes.forEach(
    () => {

      html += `

        <th
          class="total-header"
          style="
            width:${totalColumnWidth}px;
            min-width:${totalColumnWidth}px;
            max-width:${totalColumnWidth}px;
            box-sizing:border-box;
          "
        >
          合計
        </th>

        <th
          class="total-header"
          style="
            width:${totalColumnWidth}px;
            min-width:${totalColumnWidth}px;
            max-width:${totalColumnWidth}px;
            box-sizing:border-box;
          "
        >
          累計
        </th>

      `;

    }
  );


  html +=
    "</tr>";


  html +=
    "</thead>";


  html +=
    "<tbody>";


  appData.staff.forEach(
    staff => {

      const staffName =
        getStaffName(
          staff
        );


      html += `

        <tr
          class="staff-row"
          data-staff-row="${escapeHtml(
            staffName
          )}"
        >

      `;


      html += `

        <th
          class="staff-cell staff-name-cell"
          data-staff="${escapeHtml(
            staffName
          )}"
          style="
            width:${staffColumnWidth}px;
            min-width:${staffColumnWidth}px;
            max-width:${staffColumnWidth}px;
            position:sticky;
            left:0;
            z-index:90;
            background:#ffffff;
            box-sizing:border-box;
            border-right:1px solid #d1d1d6;
          "
        >

          ${escapeHtml(
            staffName
          )}

        </th>

      `;


      for (
        let day = 1;
        day <= days;
        day++
      ) {

        const dateKey =
          getDateKey(
            year,
            month,
            day
          );


        const week =
          new Date(
            year,
            month - 1,
            day
          ).getDay();


        let cls =
          "schedule-cell";


        if (
          isCompanyHoliday(
            dateKey
          )
        ) {

          cls +=
            " company-holiday";

        } else if (

          week === 0 ||

          isPublicHoliday(
            dateKey
          )

        ) {

          cls +=
            " sunday";

        } else if (
          week === 6
        ) {

          cls +=
            " saturday";

        }


        const display =
          getDisplayShift(
            staffName,
            dateKey
          );


        html += `

          <td
            class="${cls}"
            data-staff="${escapeHtml(
              staffName
            )}"
            data-date="${dateKey}"
            style="
              width:${dateColumnWidth}px;
              min-width:${dateColumnWidth}px;
              max-width:${dateColumnWidth}px;
              box-sizing:border-box;
            "
          >

            ${escapeHtml(
              display
            )}

          </td>

        `;

      }


      appData.shiftTypes.forEach(
        shift => {

          const monthly =
            calculateMonthlyTotal(

              staffName,

              shift.name,

              year,

              month

            );


          const fiscal =
            calculateFiscalTotal(

              staffName,

              shift.name,

              year,

              month

            );


          html += `

            <td
              class="total-cell"
              style="
                width:${totalColumnWidth}px;
                min-width:${totalColumnWidth}px;
                max-width:${totalColumnWidth}px;
                box-sizing:border-box;
              "
            >
              ${monthly}
            </td>

            <td
              class="total-cell"
              style="
                width:${totalColumnWidth}px;
                min-width:${totalColumnWidth}px;
                max-width:${totalColumnWidth}px;
                box-sizing:border-box;
              "
            >
              ${fiscal}
            </td>

          `;

        }
      );


      html +=
        "</tr>";

    }
  );


  html +=
    "</tbody>";


  table.style.borderCollapse =
    "separate";


  table.style.borderSpacing =
    "0";


  table.style.tableLayout =
    "fixed";


  const requiredTableWidth =

    staffColumnWidth +

    (
      days *
      dateColumnWidth
    ) +

    (
      appData.shiftTypes.length *
      2 *
      totalColumnWidth
    );


  table.style.width =
    requiredTableWidth +
    "px";


  table.style.minWidth =
    requiredTableWidth +
    "px";


  table.style.maxWidth =
    "none";


  table.innerHTML =
    html;


  table
    .querySelectorAll(
      ".staff-header"
    )
    .forEach(cell => {

      cell.style.width =
        staffColumnWidth +
        "px";

      cell.style.minWidth =
        staffColumnWidth +
        "px";

      cell.style.maxWidth =
        staffColumnWidth +
        "px";

      cell.style.position =
        "sticky";

      cell.style.left =
        "0px";

      cell.style.zIndex =
        "100";

      cell.style.background =
        "#f2f2f7";

      cell.style.boxSizing =
        "border-box";

    });


  table
    .querySelectorAll(
      ".staff-name-cell"
    )
    .forEach(cell => {

      cell.style.width =
        staffColumnWidth +
        "px";

      cell.style.minWidth =
        staffColumnWidth +
        "px";

      cell.style.maxWidth =
        staffColumnWidth +
        "px";

      cell.style.position =
        "sticky";

      cell.style.left =
        "0px";

      cell.style.zIndex =
        "90";

      cell.style.background =
        "#ffffff";

      cell.style.boxSizing =
        "border-box";

      cell.style.borderRight =
        "1px solid #d1d1d6";

    });


  bindScheduleCells();

  bindStaffNameCells();

}


/* ==================================================
   勤務セル
================================================== */

function bindScheduleCells() {

  document
    .querySelectorAll(
      ".schedule-cell"
    )
    .forEach(
      cell => {

        cell.addEventListener(
          "click",
          e => {

            e.stopPropagation();

            // =========================
            // 休暇メニュー表示中は
            // 他のセルをタップしても
            // 勤務メニューを開かない
            // =========================

            const leaveMenu =
              document.getElementById(
                "leaveMenu"
              );

            if (
              leaveMenu &&
              leaveMenu.style.display !== "none" &&
              leaveMenu.style.display !== ""
            ) {

              return;

            }

            selectedCell =
              cell;

            showShiftMenu(
              cell,
              cell.dataset.staff,
              cell.dataset.date
            );

          }
        );

      }
    );

}


/* ==================================================
   職員名
================================================== */

function bindStaffNameCells() {

  document
    .querySelectorAll(
      ".staff-name-cell"
    )
    .forEach(cell => {

      cell.addEventListener(
        "click",
        () => {

          const staff =
            cell.dataset.staff;


          openCalendarConfirm(
            staff
          );

        }
      );

    });

}

function showShiftMenu(
  cell,
  staffName,
  dateKey
) {

  const menu =
    document.getElementById(
      "shiftMenu"
    );

  if (!menu) {
    return;
  }


  const buttons =
    document.getElementById(
      "shiftMenuButtons"
    );

  if (!buttons) {
    return;
  }


  // ==========================================
  // メニューを初期化
  // ==========================================

  buttons.innerHTML = "";


  // ==========================================
  // 勤務形態
  // ==========================================

  appData.shiftTypes.forEach(
    shift => {

      const button =
        document.createElement(
          "button"
        );

      button.type = "button";

      button.className =
        "shift-menu-button";

      button.textContent =
        shift.name;

      button.addEventListener(
        "click",
        async e => {

          e.stopPropagation();

          await saveWorkShift(
            staffName,
            dateKey,
            shift.name
          );

          hideShiftMenu();

        }
      );

      buttons.appendChild(
        button
      );

    }
  );


  // ==========================================
  // 削除
  // ==========================================

  const deleteButton =
    document.createElement(
      "button"
    );

  deleteButton.type = "button";

  deleteButton.className =
    "shift-menu-button shift-delete";

  deleteButton.textContent =
    "削除";

  deleteButton.addEventListener(
    "click",
    async e => {

      e.stopPropagation();

      await saveWorkShift(
        staffName,
        dateKey,
        ""
      );

      hideShiftMenu();

    }
  );

  buttons.appendChild(
    deleteButton
  );


  // ==========================================
  // 休暇
  //
  // 休暇種類が1つ以上ある場合だけ表示
  // ==========================================

  if (
    Array.isArray(
      appData.leaveTypes
    ) &&
    appData.leaveTypes.length > 0
  ) {

    const leaveButton =
      document.createElement(
        "button"
      );

    leaveButton.type = "button";

    leaveButton.className =
      "shift-menu-button shift-leave";

    leaveButton.textContent =
      "休暇";

    leaveButton.addEventListener(
      "click",
      e => {

        e.stopPropagation();

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


  // ==========================================
  // メニュー表示
  // ==========================================

  menu.style.display = "grid";


  // ==========================================
  // 位置調整
  // ==========================================

  const rect =
    cell.getBoundingClientRect();

  const menuWidth =
    menu.offsetWidth || 230;

  const menuHeight =
    menu.offsetHeight || 200;

  let left =
    rect.left;

  let top =
    rect.bottom + 6;


  // 右端からはみ出す場合
  if (
    left + menuWidth >
    window.innerWidth - 10
  ) {

    left =
      window.innerWidth -
      menuWidth -
      10;

  }


  // 左端からはみ出す場合
  if (left < 10) {
    left = 10;
  }


  // 下からはみ出す場合
  if (
    top + menuHeight >
    window.innerHeight - 10
  ) {

    top =
      rect.top -
      menuHeight -
      6;

  }


  // 上からはみ出す場合
  if (top < 10) {
    top = 10;
  }


  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

}
/* ==================================================
   勤務メニュー
================================================== */

function showLeaveMenu(
  cell,
  staffName,
  dateKey
) {

  const menu =
    document.getElementById(
      "leaveMenu"
    );

  if (!menu) {
    return;
  }


  const buttons =
    document.getElementById(
      "leaveMenuButtons"
    );

  if (!buttons) {
    return;
  }


  // ==========================================
  // 初期化
  // ==========================================

  buttons.innerHTML = "";


  // ==========================================
  // 休暇種類
  // ==========================================

  appData.leaveTypes.forEach(
    leave => {

      const button =
        document.createElement(
          "button"
        );

      button.type = "button";

      button.className =
        "shift-menu-button";

      button.textContent =
        leave.name;


      // 休暇の色をボタンにも反映
      button.style.background =
        leave.color ||
        "#e8f5e9";


      button.addEventListener(
        "click",
        async e => {

          e.stopPropagation();

          await saveLeave(
            staffName,
            dateKey,
            leave.name
          );

          hideLeaveMenu();

        }
      );


      buttons.appendChild(
        button
      );

    }
  );


  // ==========================================
  // 休暇を解除
  // ==========================================

  const clearButton =
    document.createElement(
      "button"
    );

  clearButton.type = "button";

  clearButton.className =
    "shift-menu-button shift-delete";

  clearButton.textContent =
    "休暇を解除";


  clearButton.addEventListener(
    "click",
    async e => {

      e.stopPropagation();

      await saveLeave(
        staffName,
        dateKey,
        ""
      );

      hideLeaveMenu();

    }
  );


  buttons.appendChild(
    clearButton
  );


  // ==========================================
  // キャンセル
  // ==========================================

  const cancelButton =
    document.createElement(
      "button"
    );

  cancelButton.type = "button";

  cancelButton.className =
    "shift-menu-button shift-cancel";

  cancelButton.textContent =
    "キャンセル";


  cancelButton.addEventListener(
    "click",
    e => {

      e.stopPropagation();

      hideLeaveMenu();

    }
  );


  buttons.appendChild(
    cancelButton
  );


  // ==========================================
  // 表示
  // ==========================================

  menu.style.display =
    "grid";


  // ==========================================
  // 位置調整
  // ==========================================

  const rect =
    cell.getBoundingClientRect();

  const menuWidth =
    menu.offsetWidth || 230;

  const menuHeight =
    menu.offsetHeight || 200;

  let left =
    rect.left;

  let top =
    rect.bottom + 6;


  // 右端
  if (
    left + menuWidth >
    window.innerWidth - 10
  ) {

    left =
      window.innerWidth -
      menuWidth -
      10;

  }


  // 左端
  if (left < 10) {
    left = 10;
  }


  // 下端
  if (
    top + menuHeight >
    window.innerHeight - 10
  ) {

    top =
      rect.top -
      menuHeight -
      6;

  }


  // 上端
  if (top < 10) {
    top = 10;
  }


  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

}

function hideLeaveMenu() {

  const menu =
    document.getElementById(
      "leaveMenu"
    );

  if (!menu) {
    return;
  }

  menu.style.display =
    "none";

}


function hideLeaveMenu() {

  const menu =
    document.getElementById(
      "leaveMenu"
    );

  if (!menu) {
    return;
  }

  menu.style.display =
    "none";

}
/* ==================================================
   勤務保存
================================================== */

async function saveWorkShift(
  staffName,
  dateKey,
  shiftName
) {

  if (!supabaseClient) {
    return;
  }

  const name = getStaffName(staffName);

  cloudOperationBusy = true;

  try {

    // ==========================================
    // 削除
    // ==========================================

    if (!shiftName) {

      const { error } =
        await supabaseClient
          .from("work_shifts")
          .delete()
          .eq("staff_name", name)
          .eq("work_date", dateKey);

      if (error) {
        throw error;
      }


      setStoredShift(
        name,
        dateKey,
        ""
      );

      setStoredLeave(
        name,
        dateKey,
        ""
      );


      renderSchedule();

      return;
    }


    // ==========================================
    // 勤務を登録
    // ==========================================

    const { data, error } =
      await supabaseClient
        .from("work_shifts")
        .upsert(
          {
            staff_name: name,
            work_date: dateKey,
            shift_name: shiftName,
            leave_type: null
          },
          {
            onConflict:
              "staff_name,work_date"
          }
        )
        .select()
        .single();


    if (error) {
      throw error;
    }


    // ==========================================
    // ローカルデータ更新
    // ==========================================

    setStoredShift(
      name,
      dateKey,
      shiftName
    );

    setStoredLeave(
      name,
      dateKey,
      ""
    );


    renderSchedule();


  } catch (error) {

    console.error(
      "勤務保存エラー:",
      error
    );

    alert(
      "勤務の保存に失敗しました。\n" +
      error.message
    );

  } finally {

    cloudOperationBusy = false;

  }

}

async function saveLeave(
  staffName,
  dateKey,
  leaveType
) {

  if (!supabaseClient) {
    return;
  }

  const name =
    getStaffName(staffName);

  cloudOperationBusy = true;

  try {

    // ==========================================
    // 休暇解除
    // ==========================================

    if (!leaveType) {

      const { error } =
        await supabaseClient
          .from("work_shifts")
          .delete()
          .eq("staff_name", name)
          .eq("work_date", dateKey);

      if (error) {
        throw error;
      }


      setStoredLeave(
        name,
        dateKey,
        ""
      );

      setStoredShift(
        name,
        dateKey,
        ""
      );


      renderSchedule();

      return;
    }


    // ==========================================
    // 休暇を登録
    // ==========================================

    const { data, error } =
      await supabaseClient
        .from("work_shifts")
        .upsert(
          {
            staff_name: name,
            work_date: dateKey,
            shift_name: "",
            leave_type: leaveType
          },
          {
            onConflict:
              "staff_name,work_date"
          }
        )
        .select()
        .single();


    if (error) {
      throw error;
    }


    // ==========================================
    // ローカルデータ更新
    // ==========================================

    setStoredShift(
      name,
      dateKey,
      ""
    );

    setStoredLeave(
      name,
      dateKey,
      leaveType
    );


    renderSchedule();


  } catch (error) {

    console.error(
      "休暇保存エラー:",
      error
    );

    alert(
      "休暇の保存に失敗しました。\n" +
      error.message
    );

  } finally {

    cloudOperationBusy = false;

  }

}

/* ==================================================
   月間集計
================================================== */

function calculateMonthlyTotal(

  staffName,

  shiftName,

  year,

  month

) {

  const days =
    getDaysInMonth(
      year,
      month
    );


  let total = 0;


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const dateKey =
      getDateKey(
        year,
        month,
        day
      );


    const display =
      getDisplayShift(

        staffName,

        dateKey

      );


    if (

      display === shiftName &&

      display !== "明"

    ) {

      total++;

    }

  }


  return total;

}


/* ==================================================
   年度集計
================================================== */

function calculateFiscalTotal(

  staffName,

  shiftName,

  year,

  month

) {

  let startYear =
    year;


  if (month < 4) {

    startYear--;

  }


  let total = 0;


  for (
    let y = startYear;
    y <= year;
    y++
  ) {

    let startMonth =
      4;


    let endMonth =
      12;


    if (y === year) {

      endMonth =
        month;

    }


    for (
      let m = startMonth;
      m <= endMonth;
      m++
    ) {

      const days =
        getDaysInMonth(
          y,
          m
        );


      for (
        let day = 1;
        day <= days;
        day++
      ) {

        const dateKey =
          getDateKey(
            y,
            m,
            day
          );


        const display =
          getDisplayShift(

            staffName,

            dateKey

          );


        if (

          display === shiftName &&

          display !== "明"

        ) {

          total++;

        }

      }

    }

  }


  if (month < 4) {

    for (
      let m = 1;
      m <= month;
      m++
    ) {

      const days =
        getDaysInMonth(
          year,
          m
        );


      for (
        let day = 1;
        day <= days;
        day++
      ) {

        const dateKey =
          getDateKey(
            year,
            m,
            day
          );


        const display =
          getDisplayShift(

            staffName,

            dateKey

          );


        if (

          display === shiftName &&

          display !== "明"

        ) {

          total++;

        }

      }

    }

  }


  return total;

}


/* ==================================================
   職員追加・編集
================================================== */

async function addOrUpdateStaff() {

  const nameInput =
    document.getElementById(
      "staffNameInput"
    );


  if (!nameInput) {

    return;

  }


  const name =
    nameInput.value.trim();


  if (!name) {

    alert(
      "職員名を入力してください"
    );

    return;

  }


  if (name === "明") {

    alert(
      "「明」は登録できません"
    );

    return;

  }


  const duplicate =
    appData.staff.some(
      (staff, index) => {

        const staffName =
          getStaffName(
            staff
          );


        return (

          staffName === name &&

          index !==
            editingStaffIndex

        );

      }
    );


  if (duplicate) {

    alert(
      "同じ職員名は登録できません"
    );

    return;

  }


  cloudOperationBusy = true;


  try {

    if (
      editingStaffIndex >= 0
    ) {

      const oldStaff =
        appData.staff[
          editingStaffIndex
        ];


      const oldName =
        getStaffName(
          oldStaff
        );


      const id =
        oldStaff.id;


      if (
        oldName === name
      ) {

        const result =
          await supabaseClient

            .from(
              "staff"
            )

            .update({

              name

            })

            .eq(
              "id",
              id
            );


        if (result.error) {

          throw result.error;

        }

      }

      else {

        const workResult =
          await supabaseClient

            .from(
              "work_shifts"
            )

            .update({

              staff_name:
                name

            })

            .eq(
              "staff_name",
              oldName
            );


        if (workResult.error) {

          throw workResult.error;

        }


        const staffResult =
          await supabaseClient

            .from(
              "staff"
            )

            .update({

              name

            })

            .eq(
              "id",
              id
            );


        if (staffResult.error) {

          await supabaseClient

            .from(
              "work_shifts"
            )

            .update({

              staff_name:
                oldName

            })

            .eq(
              "staff_name",
              name
            );


          throw staffResult.error;

        }

      }


      editingStaffIndex =
        -1;


      const button =
        document.getElementById(
          "addStaffButton"
        );


      if (button) {

        button.textContent =
          "職員を追加";

      }

    }

    else {

      const maxOrder =
        appData.staff.reduce(
          (max, staff) => {

            const value =
              Number(
                staff.sort_order
              );

            return Number.isFinite(value)
              ? Math.max(
                  max,
                  value
                )
              : max;

          },
          -1
        );


      const result =
        await supabaseClient

          .from(
            "staff"
          )

          .insert({

            name,

            sort_order:
              maxOrder + 1

          });


      if (result.error) {

        throw result.error;

      }

    }


    nameInput.value =
      "";


    await loadAllFromSupabase();

    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "職員保存エラー",
      error
    );


    alert(
      "職員の保存に失敗しました。"
    );


  } finally {

    cloudOperationBusy = false;

  }

}


/* ==================================================
   職員並び順保存
================================================== */

async function saveStaffOrder() {

  if (!supabaseClient) {

    return false;

  }


  try {

    for (
      let i = 0;
      i < appData.staff.length;
      i++
    ) {

      const staff =
        appData.staff[i];


      const result =
        await supabaseClient

          .from("staff")

          .update({

            sort_order:
              i

          })

          .eq(
            "id",
            staff.id
          );


      if (result.error) {

        throw result.error;

      }


      staff.sort_order =
        i;

    }


    return true;


  } catch (error) {

    console.error(
      "職員並び順保存エラー",
      error
    );


    return false;

  }

}


/* ==================================================
   職員並び替え
================================================== */

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


  if (cloudOperationBusy) {

    return;

  }


  const temp =
    appData.staff[index];


  appData.staff[index] =
    appData.staff[newIndex];


  appData.staff[newIndex] =
    temp;


  appData.staff =
    appData.staff.map(
      (staff, i) => ({

        ...staff,

        sort_order:
          i

      })
    );


  renderStaffList();

  renderSchedule();


  cloudOperationBusy = true;


  try {

    const success =
      await saveStaffOrder();


    if (!success) {

      throw new Error(
        "職員の並び順保存に失敗しました"
      );

    }


    console.log(
      "★ 職員の並び順を保存しました"
    );


  } catch (error) {

    console.error(
      error
    );


    alert(
      "職員の並び順の保存に失敗しました。"
    );


    await loadAllFromSupabase();

    renderStaffList();

    renderSchedule();

  } finally {

    cloudOperationBusy = false;

  }

}


/* ==================================================
   職員一覧
   ★ 既存のlist-itemを使用
================================================== */

function renderStaffList() {

  const list =
    document.getElementById(
      "staffList"
    );


  if (!list) {

    return;

  }


  list.innerHTML =
    "";


  appData.staff.forEach(
    (staff, index) => {

      const name =
        getStaffName(
          staff
        );


      const item =
        document.createElement(
          "div"
        );


      item.className =
        "list-item";


      item.innerHTML = `

        <div
          class="list-item-main"
        >

          <div
            class="list-item-title"
          >
            ${escapeHtml(name)}
          </div>

        </div>

        <div
          class="list-item-buttons"
        >

          <button
            type="button"
            class="list-button move-staff-up-button"
            ${index === 0 ? "disabled" : ""}
            title="上へ"
          >
            ↑
          </button>

          <button
            type="button"
            class="list-button move-staff-down-button"
            ${index === appData.staff.length - 1 ? "disabled" : ""}
            title="下へ"
          >
            ↓
          </button>

          <button
            type="button"
            class="list-button edit-staff-button"
          >
            編集
          </button>

          <button
            type="button"
            class="list-button delete delete-staff-button"
          >
            削除
          </button>

        </div>

      `;


      const upButton =
        item.querySelector(
          ".move-staff-up-button"
        );


      if (upButton) {

        upButton.addEventListener(
          "click",
          async () => {

            await moveStaff(
              index,
              -1
            );

          }
        );

      }


      const downButton =
        item.querySelector(
          ".move-staff-down-button"
        );


      if (downButton) {

        downButton.addEventListener(
          "click",
          async () => {

            await moveStaff(
              index,
              1
            );

          }
        );

      }


      const editButton =
        item.querySelector(
          ".edit-staff-button"
        );


      if (editButton) {

        editButton.addEventListener(
          "click",
          () => {

            editingStaffIndex =
              index;


            const input =
              document.getElementById(
                "staffNameInput"
              );


            if (input) {

              input.value =
                name;

              input.focus();

            }


            const button =
              document.getElementById(
                "addStaffButton"
              );


            if (button) {

              button.textContent =
                "職員を更新";

            }

          }
        );

      }


      const deleteButton =
        item.querySelector(
          ".delete-staff-button"
        );


      if (deleteButton) {

        deleteButton.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                `${name}を削除しますか？`
              )
            ) {

              return;

            }


            if (!supabaseClient) {

              alert(
                "Supabaseに接続されていません。"
              );

              return;

            }


            cloudOperationBusy = true;


            try {

              const workResult =
                await supabaseClient

                  .from(
                    "work_shifts"
                  )

                  .delete()

                  .eq(
                    "staff_name",
                    name
                  );


              if (
                workResult.error
              ) {

                throw workResult.error;

              }


              const result =
                await supabaseClient

                  .from(
                    "staff"
                  )

                  .delete()

                  .eq(
                    "id",
                    staff.id
                  );


              if (result.error) {

                throw result.error;

              }


              if (
                editingStaffIndex ===
                index
              ) {

                editingStaffIndex =
                  -1;


                const input =
                  document.getElementById(
                    "staffNameInput"
                  );


                if (input) {

                  input.value =
                    "";

                }


                const button =
                  document.getElementById(
                    "addStaffButton"
                  );


                if (button) {

                  button.textContent =
                    "職員を追加";

                }

              }


              await loadAllFromSupabase();


              /*
               * 削除後も0,1,2...の順番になるよう整理
               */

              for (
                let i = 0;
                i < appData.staff.length;
                i++
              ) {

                const currentStaff =
                  appData.staff[i];


                const orderResult =
                  await supabaseClient

                    .from("staff")

                    .update({

                      sort_order:
                        i

                    })

                    .eq(
                      "id",
                      currentStaff.id
                    );


                if (
                  orderResult.error
                ) {

                  throw orderResult.error;

                }


                currentStaff.sort_order =
                  i;

              }


              await loadAllFromSupabase();


              renderStaffList();

              renderSchedule();


            } catch (error) {

              console.error(
                "職員削除エラー",
                error
              );


              alert(
                "職員の削除に失敗しました。"
              );


            } finally {

              cloudOperationBusy = false;

            }

          }
        );

      }


      list.appendChild(
        item
      );

    }
  );


  const count =
    document.getElementById(
      "staffCount"
    );


  if (count) {

    count.textContent =
      `${appData.staff.length}人`;

  }

}


/* ==================================================
   勤務形態追加・編集
================================================== */

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


  if (!nameInput) {

    return;

  }


  const name =
    nameInput.value.trim();


  const start =
    startInput
      ? startInput.value
      : "";


  const end =
    endInput
      ? endInput.value
      : "";


  const breakTime =
    breakInput
      ? breakInput.value
      : "";


  if (!name) {

    alert(
      "勤務形態名を入力してください"
    );

    return;

  }


  if (name === "明") {

    alert(
      "「明」は登録できません"
    );

    return;

  }


  const duplicate =
    appData.shiftTypes.some(
      (shift, index) => {

        return (

          shift.name === name &&

          index !==
            editingShiftIndex

        );

      }
    );


  if (duplicate) {

    alert(
      "同じ勤務形態名を登録できません"
    );

    return;

  }


  cloudOperationBusy = true;


  try {

    if (
      editingShiftIndex >= 0
    ) {

      const oldShift =
        appData.shiftTypes[
          editingShiftIndex
        ];


      if (
        oldShift.name === name
      ) {

        const result =
          await supabaseClient

            .from(
              "shift_types"
            )

            .update({

              name,

              start_time:
                start || null,

              end_time:
                end || null,

              break_time:
                breakTime || null

            })

            .eq(
              "id",
              oldShift.id
            );


        if (result.error) {

          throw result.error;

        }

      }

      else {

        const workResult =
          await supabaseClient

            .from(
              "work_shifts"
            )

            .update({

              shift_name:
                name

            })

            .eq(
              "shift_name",
              oldShift.name
            );


        if (workResult.error) {

          throw workResult.error;

        }


        const shiftResult =
          await supabaseClient

            .from(
              "shift_types"
            )

            .update({

              name,

              start_time:
                start || null,

              end_time:
                end || null,

              break_time:
                breakTime || null

            })

            .eq(
              "id",
              oldShift.id
            );


        if (shiftResult.error) {

          await supabaseClient

            .from(
              "work_shifts"
            )

            .update({

              shift_name:
                oldShift.name

            })

            .eq(
              "shift_name",
              name
            );


          throw shiftResult.error;

        }

      }


      editingShiftIndex =
        -1;


      const button =
        document.getElementById(
          "addShiftButton"
        );


      if (button) {

        button.textContent =
          "勤務形態を追加";

      }

    }

    else {

      const result =
        await supabaseClient

          .from(
            "shift_types"
          )

          .insert({

            name,

            start_time:
              start || null,

            end_time:
              end || null,

            break_time:
              breakTime || null

          });


      if (result.error) {

        throw result.error;

      }

    }


    nameInput.value =
      "";


    if (startInput) {

      startInput.value =
        "";

    }


    if (endInput) {

      endInput.value =
        "";

    }


    if (breakInput) {

      breakInput.value =
        "";

    }


    await loadAllFromSupabase();

    renderShiftList();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務形態保存エラー",
      error
    );


    alert(
      "勤務形態の保存に失敗しました。"
    );


  } finally {

    cloudOperationBusy = false;

  }

}


/* ==================================================
   勤務形態一覧
   ★ 既存のlist-itemを使用
================================================== */

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


      const timeText =

        shift.start &&
        shift.end

          ? `${shift.start} ～ ${shift.end}`

          : "";


      item.innerHTML = `

        <div
          class="list-item-main"
        >

          <div
            class="list-item-title"
          >
            ${escapeHtml(
              shift.name
            )}
          </div>

          <div
            class="list-item-sub"
          >
            ${escapeHtml(
              timeText
            )}
          </div>

        </div>

        <div
          class="list-item-buttons"
        >

          <button
            type="button"
            class="list-button edit-shift-button"
          >
            編集
          </button>

          <button
            type="button"
            class="list-button delete delete-shift-button"
          >
            削除
          </button>

        </div>

      `;


      const editButton =
        item.querySelector(
          ".edit-shift-button"
        );


      if (editButton) {

        editButton.addEventListener(
          "click",
          () => {

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


            if (nameInput) {

              nameInput.value =
                shift.name;

              nameInput.focus();

            }


            if (startInput) {

              startInput.value =
                shift.start || "";

            }


            if (endInput) {

              endInput.value =
                shift.end || "";

            }


            if (breakInput) {

              breakInput.value =
                shift.break || "";

            }


            editingShiftIndex =
              index;


            const button =
              document.getElementById(
                "addShiftButton"
              );


            if (button) {

              button.textContent =
                "勤務形態を更新";

            }

          }
        );

      }


      const deleteButton =
        item.querySelector(
          ".delete-shift-button"
        );


      if (deleteButton) {

        deleteButton.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                `${shift.name}を削除しますか？`
              )
            ) {

              return;

            }


            cloudOperationBusy = true;


            try {

              const workResult =
                await supabaseClient

                  .from(
                    "work_shifts"
                  )

                  .delete()

                  .eq(
                    "shift_name",
                    shift.name
                  );


              if (
                workResult.error
              ) {

                throw workResult.error;

              }


              const result =
                await supabaseClient

                  .from(
                    "shift_types"
                  )

                  .delete()

                  .eq(
                    "id",
                    shift.id
                  );


              if (result.error) {

                throw result.error;

              }


              if (
                editingShiftIndex ===
                index
              ) {

                editingShiftIndex =
                  -1;


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


                if (breakInput) {

                  breakInput.value =
                    "";

                }


                const button =
                  document.getElementById(
                    "addShiftButton"
                  );


                if (button) {

                  button.textContent =
                    "勤務形態を追加";

                }

              }


              await loadAllFromSupabase();

              renderShiftList();

              renderSchedule();


            } catch (error) {

              console.error(
                "勤務形態削除エラー",
                error
              );


              alert(
                "勤務形態の削除に失敗しました。"
              );


            } finally {

              cloudOperationBusy = false;

            }

          }
        );

      }


      list.appendChild(
        item
      );

    }
  );

}


/* ==================================================
   休業設定
   ★ Supabase保存・編集対応
================================================== */

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


  if (
    !nameInput ||
    !startInput
  ) {

    return;

  }


  const name =
    nameInput.value.trim();


  const start =
    startInput.value;


  const end =

    endInput &&
    endInput.value

      ? endInput.value

      : start;


  if (!name) {

    alert(
      "休業名を入力してください"
    );

    return;

  }


  if (!start) {

    alert(
      "開始日を入力してください"
    );

    return;

  }


  if (start > end) {

    alert(
      "終了日は開始日以降にしてください"
    );

    return;

  }


  const overlap =
    appData.companyHolidays.some(
      h => {

        if (
          editingHolidayId &&
          String(h.id) ===
            String(editingHolidayId)
        ) {

          return false;

        }


        return (
          start <= h.end &&
          end >= h.start
        );

      }
    );


  if (overlap) {

    alert(
      "既に登録されている休業期間と重複しています"
    );

    return;

  }


  if (!supabaseClient) {

    alert(
      "Supabaseに接続されていません。"
    );

    return;

  }


  cloudOperationBusy = true;


  try {

    let result;


    if (editingHolidayId) {

      result =
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


      if (result.error) {

        throw result.error;

      }


      editingHolidayId =
        null;


      const button =
        document.getElementById(
          "addCompanyHolidayButton"
        );


      if (button) {

        button.textContent =
          "休業を登録";

      }

    }

    else {

      result =
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

          });


      if (result.error) {

        console.error(
          "company_holidays insert:",
          result.error
        );

        throw result.error;

      }

    }


    nameInput.value =
      "";


    startInput.value =
      "";


    if (endInput) {

      endInput.value =
        "";

    }


    await loadAllFromSupabase();


    renderHolidayList();

    renderSchedule();


    console.log(
      "★ 休業設定を保存しました"
    );


  } catch (error) {

    console.error(
      "休業設定保存エラー",
      error
    );


    alert(
      "休業設定の保存に失敗しました。\nSupabaseのcompany_holidays設定を確認してください。"
    );


  } finally {

    cloudOperationBusy = false;

  }

}


/* ==================================================
   休業一覧
   ★ 既存のlist-itemを使用
================================================== */

function renderHolidayList() {

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


      const dateText =

        holiday.start ===
        holiday.end

          ? formatDateJP(
              holiday.start
            )

          : `${formatDateJP(
              holiday.start
            )} ～ ${formatDateJP(
              holiday.end
            )}`;


      item.innerHTML = `

        <div
          class="list-item-main"
        >

          <div
            class="list-item-title"
          >
            ${escapeHtml(
              holiday.name
            )}
          </div>

          <div
            class="list-item-sub"
          >
            ${escapeHtml(
              dateText
            )}
          </div>

        </div>

        <div
          class="list-item-buttons"
        >

          <button
            type="button"
            class="list-button edit-holiday-button"
          >
            編集
          </button>

          <button
            type="button"
            class="list-button delete delete-holiday-button"
          >
            削除
          </button>

        </div>

      `;


      const editButton =
        item.querySelector(
          ".edit-holiday-button"
        );


      if (editButton) {

        editButton.addEventListener(
          "click",
          () => {

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


            if (nameInput) {

              nameInput.value =
                holiday.name;

              nameInput.focus();

            }


            if (startInput) {

              startInput.value =
                holiday.start;

            }


            if (endInput) {

              endInput.value =
                holiday.start ===
                holiday.end

                  ? ""

                  : holiday.end;

            }


            editingHolidayId =
              holiday.id;


            const addButton =
              document.getElementById(
                "addCompanyHolidayButton"
              );


            if (addButton) {

              addButton.textContent =
                "休業を更新";

            }

          }
        );

      }


      const deleteButton =
        item.querySelector(
          ".delete-holiday-button"
        );


      if (deleteButton) {

        deleteButton.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                `${holiday.name}を削除しますか？`
              )
            ) {

              return;

            }


            if (!supabaseClient) {

              alert(
                "Supabaseに接続されていません。"
              );

              return;

            }


            cloudOperationBusy = true;


            try {

              let result;


              if (holiday.id) {

                result =
                  await supabaseClient

                    .from(
                      "company_holidays"
                    )

                    .delete()

                    .eq(
                      "id",
                      holiday.id
                    );

              }

              else {

                result =
                  await supabaseClient

                    .from(
                      "company_holidays"
                    )

                    .delete()

                    .eq(
                      "name",
                      holiday.name
                    )

                    .eq(
                      "start_date",
                      holiday.start
                    )

                    .eq(
                      "end_date",
                      holiday.end
                    );

              }


              if (result.error) {

                throw result.error;

              }


              if (
                editingHolidayId &&
                String(editingHolidayId) ===
                  String(holiday.id)
              ) {

                editingHolidayId =
                  null;


                const addButton =
                  document.getElementById(
                    "addCompanyHolidayButton"
                  );


                if (addButton) {

                  addButton.textContent =
                    "休業を登録";

                }

              }


              await loadAllFromSupabase();


              renderHolidayList();

              renderSchedule();


              console.log(
                "★ 休業設定を削除しました"
              );


            } catch (error) {

              console.error(
                "休業設定削除エラー",
                error
              );


              alert(
                "休業設定の削除に失敗しました。"
              );


            } finally {

              cloudOperationBusy = false;

            }

          }
        );

      }


      list.appendChild(
        item
      );

    }
  );

}


/* ==================================================
   明け時間
================================================== */

async function saveAkeTime() {

  const start =
    document.getElementById(
      "akeStartInput"
    );

  const end =
    document.getElementById(
      "akeEndInput"
    );

  if (!start || !end) {
    return;
  }

  if (
    !start.value ||
    !end.value
  ) {

    alert(
      "開始時間と終了時間を入力してください"
    );

    return;
  }

  if (
    start.value >=
    end.value
  ) {

    alert(
      "明け時間の終了は開始より後にしてください"
    );

    return;
  }

  const newAkeTime = {

    start:
      start.value,

    end:
      end.value

  };

  // ローカル保存
  appData.akeTime =
    newAkeTime;

  saveLocalData();

  // Supabase保存
  if (supabaseClient) {

    const result =
      await supabaseClient
        .from("app_settings")
        .upsert(
          [
            {
              setting_name:
                "ake_start",
              setting_value:
                start.value
            },
            {
              setting_name:
                "ake_end",
              setting_value:
                end.value
            }
          ],
          {
            onConflict:
              "setting_name"
          }
        );

    if (result.error) {

      console.error(
        "明け時間のクラウド保存に失敗:",
        result.error
      );

      alert(
        "明け時間をクラウドに保存できませんでした"
      );

      return;
    }
  }

  alert(
    "明け時間を保存しました"
  );
}


/* ==================================================
   カレンダー確認
================================================== */

function openCalendarConfirm(
  staffName
) {

  const name =
    getStaffName(
      staffName
    );


  const title =
    document.getElementById(
      "calendarConfirmTitle"
    );


  const text =
    document.getElementById(
      "calendarConfirmText"
    );


  const modal =
    document.getElementById(
      "calendarConfirm"
    );


  if (!modal) {

    return;

  }


  modal.dataset.staff =
    name;


  if (title) {

    title.textContent =
      `${name}の勤務表`;

  }


  if (text) {

    text.textContent =
      `${name}の勤務カレンダーを登録しますか？`;

  }


  modal.style.display =
    "flex";

}


/* ==================================================
   Webcal登録
================================================== */

function subscribeStaffCalendar() {

  const modal =
    document.getElementById(
      "calendarConfirm"
    );


  if (!modal) {

    return;

  }


  const staffName =
    modal.dataset.staff;


  if (!staffName) {

    return;

  }


  const staff =
    appData.staff.find(
      item =>
        getStaffName(item) ===
        staffName
    );


  if (
    !staff ||
    !staff.calendar_token
  ) {

    alert(
      "この職員のカレンダー情報がありません。"
    );

    return;

  }


  const webcalUrl =
    "webcal://" +
    SUPABASE_URL
      .replace(
        "https://",
        ""
      ) +
    "/functions/v1/staff-calendar?token=" +
    encodeURIComponent(
      staff.calendar_token
    );


  closeCalendarModal();


  window.location.href =
    webcalUrl;

}


function closeCalendarModal() {

  const modal =
    document.getElementById(
      "calendarConfirm"
    );


  if (modal) {

    modal.style.display =
      "none";

  }

}


/* ==================================================
   カレンダー出力
================================================== */

function exportCalendar() {

  const modal =
    document.getElementById(
      "calendarConfirm"
    );


  if (!modal) {

    return;

  }


  const staffName =
    modal.dataset.staff;


  if (!staffName) {

    return;

  }


  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth() + 1;


  let ics =
    "BEGIN:VCALENDAR\r\n";


  ics +=
    "VERSION:2.0\r\n";


  ics +=
    "PRODID:-//Kinmu App//JP\r\n";


  ics +=
    "CALSCALE:GREGORIAN\r\n";


  const days =
    getDaysInMonth(
      year,
      month
    );


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const dateKey =
      getDateKey(
        year,
        month,
        day
      );


    const shiftName =
      getDisplayShift(

        staffName,

        dateKey

      );


    if (!shiftName) {

      continue;

    }


    const uid =
      `${staffName}-${dateKey}-${Date.now()}@kinmu-app`;


    if (
      shiftName ===
      "休み"
    ) {

      ics +=
        createAllDayEvent(

          uid,

          dateKey,

          shiftName,

          staffName

        );


      continue;

    }


    if (
      shiftName ===
      "明"
    ) {

      ics +=
        createTimedEvent(

          uid,

          dateKey,

          shiftName,

          appData.akeTime.start,

          appData.akeTime.end,

          staffName

        );


      continue;

    }


    const shift =
      appData.shiftTypes.find(
        s =>
          s.name ===
          shiftName
      );


    if (!shift) {

      continue;

    }


    if (
      !shift.start ||
      !shift.end
    ) {

      ics +=
        createAllDayEvent(

          uid,

          dateKey,

          shiftName,

          staffName

        );

    } else {

      ics +=
        createTimedEvent(

          uid,

          dateKey,

          shiftName,

          shift.start,

          shift.end,

          staffName

        );

    }

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
    `${staffName}_${year}年${month}月勤務表.ics`;


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


/* ==================================================
   終日イベント
================================================== */

function createAllDayEvent(

  uid,

  dateKey,

  title,

  staffName

) {

  const date =
    dateKey.replace(
      /-/g,
      ""
    );


  const next =
    addOneDay(
      dateKey
    ).replace(
      /-/g,
      ""
    );


  let text =
    "BEGIN:VEVENT\r\n";


  text +=
    `UID:${uid}\r\n`;


  text +=
    `DTSTAMP:${utcNow()}\r\n`;


  text +=
    `DTSTART;VALUE=DATE:${date}\r\n`;


  text +=
    `DTEND;VALUE=DATE:${next}\r\n`;


  text +=
    `SUMMARY:${escapeICS(
      title
    )}\r\n`;


  text +=
    `DESCRIPTION:${escapeICS(
      getOtherStaffDescription(
        staffName,
        dateKey
      )
    )}\r\n`;


  text +=
    "END:VEVENT\r\n";


  return text;

}


/* ==================================================
   時間指定イベント
================================================== */

function createTimedEvent(

  uid,

  dateKey,

  title,

  start,

  end,

  staffName

) {

  const startDate =
    makeDateTime(
      dateKey,
      start
    );


  let endDate =
    makeDateTime(
      dateKey,
      end
    );


  if (
    endDate <=
    startDate
  ) {

    endDate =
      new Date(
        endDate
      );


    endDate.setDate(
      endDate.getDate() + 1
    );

  }


  let text =
    "BEGIN:VEVENT\r\n";


  text +=
    `UID:${uid}\r\n`;


  text +=
    `DTSTAMP:${utcNow()}\r\n`;


  text +=
    `DTSTART:${formatUTC(
      startDate
    )}\r\n`;


  text +=
    `DTEND:${formatUTC(
      endDate
    )}\r\n`;


  text +=
    `SUMMARY:${escapeICS(
      title
    )}\r\n`;


  text +=
    `DESCRIPTION:${escapeICS(
      getOtherStaffDescription(
        staffName,
        dateKey
      )
    )}\r\n`;


  text +=
    "END:VEVENT\r\n";


  return text;

}


/* ==================================================
   日時作成
================================================== */

function makeDateTime(
  dateKey,
  time
) {

  const [
    y,
    m,
    d
  ] =
    dateKey
      .split("-")
      .map(Number);


  const [
    hh,
    mm
  ] =
    time
      .split(":")
      .map(Number);


  return new Date(

    y,

    m - 1,

    d,

    hh,

    mm,

    0

  );

}


/* ==================================================
   UTC
================================================== */

function formatUTC(
  date
) {

  return (

    date.getUTCFullYear() +

    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0") +

    String(
      date.getUTCDate()
    ).padStart(2, "0") +

    "T" +

    String(
      date.getUTCHours()
    ).padStart(2, "0") +

    String(
      date.getUTCMinutes()
    ).padStart(2, "0") +

    String(
      date.getUTCSeconds()
    ).padStart(2, "0"
    ) +

    "Z"

  );

}


function utcNow() {

  return formatUTC(
    new Date()
  );

}


/* ==================================================
   翌日
================================================== */

function addOneDay(
  dateKey
) {

  const [
    y,
    m,
    d
  ] =
    dateKey
      .split("-")
      .map(Number);


  const date =
    new Date(
      y,
      m - 1,
      d
    );


  date.setDate(
    date.getDate() + 1
  );


  return getDateKey(

    date.getFullYear(),

    date.getMonth() + 1,

    date.getDate()

  );

}


/* ==================================================
   他職員の勤務
================================================== */

function getOtherStaffDescription(

  currentStaff,

  dateKey

) {

  const currentName =
    getStaffName(
      currentStaff
    );


  const lines = [];


  appData.staff.forEach(
    staff => {

      const staffName =
        getStaffName(
          staff
        );


      if (
        staffName ===
        currentName
      ) {

        return;

      }


      const shift =
        getDisplayShift(

          staffName,

          dateKey

        );


      if (shift) {

        lines.push(

          `${staffName}: ${shift}`

        );

      }

    }
  );


  return lines.join(
    "\n"
  );

}


/* ==================================================
   月削除
================================================== */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth() + 1;


  if (
    !confirm(
      `${year}年${month}月の勤務データを削除しますか？`
    )
  ) {

    return;

  }


  const start =
    getDateKey(
      year,
      month,
      1
    );


  const end =
    getDateKey(
      year,
      month,
      getDaysInMonth(
        year,
        month
      )
    );


  cloudOperationBusy = true;


  try {

    const result =
      await supabaseClient

        .from(
          "work_shifts"
        )

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


    await loadAllFromSupabase();

    renderSchedule();


  } catch (error) {

    console.error(
      "月削除エラー",
      error
    );


    alert(
      "月の削除に失敗しました。"
    );


  } finally {

    cloudOperationBusy = false;

  }

}


/* ==================================================
   年度削除
================================================== */

async function deleteFiscalYear() {

  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth() + 1;


  const fiscalStart =
    month >= 4
      ? year
      : year - 1;


  if (
    !confirm(
      `${fiscalStart}年度の勤務データを削除しますか？`
    )
  ) {

    return;

  }


  const start =
    `${fiscalStart}-04-01`;


  const end =
    `${fiscalStart + 1}-03-31`;


  cloudOperationBusy = true;


  try {

    const result =
      await supabaseClient

        .from(
          "work_shifts"
        )

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


    await loadAllFromSupabase();

    renderSchedule();


  } catch (error) {

    console.error(
      "年度削除エラー",
      error
    );


    alert(
      "年度の削除に失敗しました。"
    );


  } finally {

    cloudOperationBusy = false;

  }

}


/* ==================================================
   公休日API
================================================== */

async function loadPublicHolidays() {

  try {

    const response =
      await fetch(

        "https://holidays-jp.github.io/api/v1/date.json"

      );


    if (!response.ok) {

      throw new Error(
        "祝日データ取得失敗"
      );

    }


    publicHolidays =
      await response.json();


    renderSchedule();


  } catch (e) {

    console.warn(

      "祝日データを取得できませんでした",

      e

    );

  }

}


/* ==================================================
   HTMLエスケープ
================================================== */

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


/* ==================================================
   ICSエスケープ
================================================== */

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
      /\r?\n/g,
      "\\n"
    )

    .replace(
      /;/g,
      "\\;"
    )

    .replace(
      /,/g,
      "\\,"
    );

}
