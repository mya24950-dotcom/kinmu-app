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

  akeTime: {

    start: "05:30",

    end: "11:15"

  }

};


let currentDate =
  new Date();

currentDate.setDate(1);


let editingStaffIndex =
  -1;

let editingShiftIndex =
  -1;

let editingLeaveId =
  null;

let editingHolidayId =
  null;


let selectedCell =
  null;


let publicHolidays =
  {};


/* ==================================================
   同期管理
================================================== */

let realtimeChannel =
  null;

let realtimeReloadTimer =
  null;

let autoSyncTimer =
  null;

let realtimeUpdating =
  false;

let cloudOperationBusy =
  false;

let realtimeReloadPending =
  false;


/* ==================================================
   メニュー状態
================================================== */

let shiftMenuMode =
  "shift";


/* ==================================================
   固定ヘッダー管理
================================================== */

/*
  今回は固定レイヤーを2つだけ使用します。

  ① scheduleFixedHeader
     → 日付・合計・累計のヘッダー
     → 縦方向だけ固定
     → 横方向は勤務表と一緒に動く

  ② scheduleFixedStaffColumn
     → 左上の「職員」だけ
     → 縦・横どちらでも固定

  職員名の行は固定レイヤーには入れません。
  通常テーブルの sticky left だけで横方向を固定します。

  これにより、

  横スクロール
    ↓
  職員名だけ左に残る

  縦スクロール
    ↓
  職員名は普通に上へ流れる
  ヘッダーだけ残る

  というExcelの「ウィンドウ枠の固定 B2」に近い動きになります。
*/

let scheduleFixedHeader =
  null;

let scheduleFixedHeaderTable =
  null;

let scheduleFixedStaffColumn =
  null;

let scheduleFixedStaffTable =
  null;


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


    loadLocalData();


    bindEvents();


    try {

      await loadAllFromSupabase();

    } catch (error) {

      console.error(
        "Supabaseデータ取得失敗",
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


    renderAll();


    loadPublicHolidays();


    alert(
      "Supabaseへの接続に失敗しました。\nアプリ自体は起動します。"
    );

  }

}


/* ==================================================
   ローカルデータ読み込み
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


    appData.leaveTypes =
      Array.isArray(
        parsed.leaveTypes
      )
        ? parsed.leaveTypes
        : [];


    appData.akeTime =
      parsed.akeTime &&
      typeof parsed.akeTime ===
        "object"

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
   ローカル保存
================================================== */

function saveLocalData() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({

        companyHolidays:
          appData.companyHolidays,

        leaveTypes:
          appData.leaveTypes,

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

    throw new Error(
      "Supabaseクライアントがありません"
    );

  }


  const staffResult =
    await supabaseClient
      .from("staff")
      .select(
        "id,name,created_at,sort_order,calendar_token"
      );


  if (staffResult.error) {

    throw staffResult.error;

  }


  const shiftResult =
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


  if (shiftResult.error) {

    throw shiftResult.error;

  }


  const workResult =
    await supabaseClient
      .from("work_shifts")
      .select(
        "id,staff_name,work_date,shift_name,leave_type"
      );


  if (workResult.error) {

    throw workResult.error;

  }


  const leaveResult =
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


  if (leaveResult.error) {

    console.error(
      "leave_types取得エラー:",
      leaveResult.error
    );

  }


  const holidayResult =
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


  if (holidayResult.error) {

    console.error(
      "company_holidays取得エラー:",
      holidayResult.error
    );

  }


  const rawStaff =
    (staffResult.data || [])
      .map(
        (row, index) => ({

          id:
            row.id,

          name:
            String(
              row.name || ""
            ),

          sort_order:
            row.sort_order !== null &&
            row.sort_order !== undefined

              ? Number(
                  row.sort_order
                )

              : null,

          calendar_token:
            row.calendar_token || "",

          created_at:
            row.created_at || "",

          originalIndex:
            index

        })
      )
      .filter(
        row =>
          row.name &&
          row.name !== "明"
      );


  rawStaff.sort(
    (a, b) => {

      const aHas =
        Number.isFinite(
          a.sort_order
        );


      const bHas =
        Number.isFinite(
          b.sort_order
        );


      if (
        aHas &&
        bHas
      ) {

        if (
          a.sort_order !==
          b.sort_order
        ) {

          return (
            a.sort_order -
            b.sort_order
          );

        }

      }


      if (
        aHas &&
        !bHas
      ) {

        return -1;

      }


      if (
        !aHas &&
        bHas
      ) {

        return 1;

      }


      if (
        a.created_at &&
        b.created_at
      ) {

        const result =
          String(
            a.created_at
          ).localeCompare(
            String(
              b.created_at
            )
          );


        if (
          result !== 0
        ) {

          return result;

        }

      }


      return (
        a.originalIndex -
        b.originalIndex
      );

    }
  );


  appData.staff =
    rawStaff.map(
      row => ({

        id:
          row.id,

        name:
          row.name,

        sort_order:
          row.sort_order,

        calendar_token:
          row.calendar_token || ""

      })
    );


  appData.shiftTypes =
    (shiftResult.data || [])
      .map(
        row => ({

          id:
            row.id,

          name:
            String(
              row.name || ""
            ),

          start:
            String(
              row.start_time || ""
            ),

          end:
            String(
              row.end_time || ""
            ),

          break:
            String(
              row.break_time || ""
            )

        })
      )
      .filter(
        row =>
          row.name &&
          row.name !== "明"
      );


  if (
    !leaveResult.error
  ) {

    appData.leaveTypes =
      (leaveResult.data || [])
        .map(
          row => ({

            id:
              row.id,

            name:
              String(
                row.name || ""
              ),

            color:
              String(
                row.color ||
                "#FFD54F"
              ),

            created_at:
              row.created_at || ""

          })
        )
        .filter(
          row =>
            row.name
        );

  }


  appData.shifts =
    {};


  appData.staff.forEach(
    staff => {

      appData.shifts[
        staff.name
      ] = {};

    }
  );


  (workResult.data || [])
    .forEach(
      row => {

        if (
          !row.staff_name ||
          !row.work_date
        ) {

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


        appData.shifts[
          row.staff_name
        ][
          row.work_date
        ] = {

          shiftName:
            row.shift_name || "",

          leaveType:
            row.leave_type || ""

        };

      }
    );


  if (
    !holidayResult.error
  ) {

    appData.companyHolidays =
      (holidayResult.data || [])
        .map(
          row => ({

            id:
              row.id,

            name:
              String(
                row.name || ""
              ),

            start:
              String(
                row.start_date || ""
              ),

            end:
              String(
                row.end_date || ""
              )

          })
        )
        .filter(
          row =>
            row.name &&
            row.start &&
            row.end
        )
        .sort(
          (a, b) =>
            a.start.localeCompare(
              b.start
            )
        );

  }


  const akeResult =
    await supabaseClient
      .from("app_settings")
      .select(
        "setting_name,setting_value"
      );


  if (
    !akeResult.error
  ) {

    let akeStart =
      "05:30";

    let akeEnd =
      "11:15";


    (akeResult.data || [])
      .forEach(
        row => {

          if (
            row.setting_name ===
            "ake_start"
          ) {

            akeStart =
              row.setting_value ||
              "05:30";

          }


          if (
            row.setting_name ===
            "ake_end"
          ) {

            akeEnd =
              row.setting_value ||
              "11:15";

          }

        }
      );


    appData.akeTime = {

      start:
        akeStart,

      end:
        akeEnd

    };

  }


  saveLocalData();

}


/* ==================================================
   Realtime
================================================== */

function setupRealtime() {

  if (!supabaseClient) {

    return;

  }


  if (
    realtimeChannel
  ) {

    try {

      supabaseClient.removeChannel(
        realtimeChannel
      );

    } catch (error) {

      console.warn(
        "Realtime旧チャンネル削除エラー",
        error
      );

    }


    realtimeChannel =
      null;

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
          table: "leave_types"
        },
        payload => {

          console.log(
            "Realtime leave_types:",
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

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings"
        },
        payload => {

          console.log(
            "Realtime app_settings:",
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
            status ===
            "SUBSCRIBED"
          ) {

            console.log(
              "★ Realtime接続成功"
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

            console.warn(
              "Realtime接続エラー。再接続します。"
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

  if (
    cloudOperationBusy
  ) {

    realtimeReloadPending =
      true;

    return;

  }


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


  if (
    cloudOperationBusy
  ) {

    realtimeReloadPending =
      true;

    return;

  }


  if (
    realtimeUpdating
  ) {

    realtimeReloadPending =
      true;

    return;

  }


  realtimeUpdating =
    true;


  try {

    await loadAllFromSupabase();


    renderAll();


    console.log(
      "★ Supabaseデータを画面へ反映しました"
    );

  } catch (error) {

    console.error(
      "自動更新エラー",
      error
    );

  } finally {

    realtimeUpdating =
      false;


    if (
      realtimeReloadPending &&
      !cloudOperationBusy
    ) {

      realtimeReloadPending =
        false;


      scheduleRealtimeReload();

    }

  }

}


/* ==================================================
   保存完了後のRealtime処理
================================================== */

function finishCloudOperation() {

  cloudOperationBusy =
    false;


  if (
    realtimeReloadPending
  ) {

    realtimeReloadPending =
      false;


    setTimeout(
      () => {

        reloadFromSupabase();

      },
      100
    );

  }

}


/* ==================================================
   自動同期
================================================== */

function startAutoSync() {

  if (
    autoSyncTimer
  ) {

    clearInterval(
      autoSyncTimer
    );

  }


  autoSyncTimer =
    setInterval(
      async () => {

        if (
          !supabaseClient
        ) {

          return;

        }


        if (
          cloudOperationBusy
        ) {

          realtimeReloadPending =
            true;

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

}


/* ==================================================
   画面復帰時同期
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


  const addLeave =
    document.getElementById(
      "addLeaveButton"
    );


  if (addLeave) {

    addLeave.addEventListener(
      "click",
      addOrUpdateLeave
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
        !menu.contains(
          e.target
        ) &&
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

function showPage(
  page
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      p => {

        p.style.display =
          "none";

      }
    );


  const target =
    document.getElementById(
      page + "Page"
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
            page
        );

      }
    );


  hideShiftMenu();


  if (
    page ===
    "schedule"
  ) {

    renderSchedule();

  }


  if (
    page ===
    "staff"
  ) {

    renderStaffList();

  }


  if (
    page ===
    "leave"
  ) {

    renderLeaveList();

  }


  if (
    page ===
    "shift"
  ) {

    renderShiftList();

  }


  if (
    page ===
    "holiday"
  ) {

    renderHolidayList();

  }

}


/* ==================================================
   全体描画
================================================== */

function renderAll() {

  renderSchedule();

  renderStaffList();

  renderLeaveList();

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
   勤務データ取得
================================================== */

function getStoredShift(
  staffName,
  dateKey
) {

  const name =
    getStaffName(
      staffName
    );


  const data =
    appData.shifts[name] &&
    appData.shifts[name][dateKey];


  if (!data) {

    return "";

  }


  if (
    typeof data ===
    "string"
  ) {

    return data;

  }


  return data.shiftName || "";

}


function getStoredLeave(
  staffName,
  dateKey
) {

  const name =
    getStaffName(
      staffName
    );


  const data =
    appData.shifts[name] &&
    appData.shifts[name][dateKey];


  if (!data) {

    return "";

  }


  if (
    typeof data ===
    "string"
  ) {

    return "";

  }


  return data.leaveType || "";

}


function setStoredShift(
  staffName,
  dateKey,
  shiftName,
  leaveType
) {

  const name =
    getStaffName(
      staffName
    );


  if (
    !appData.shifts[name]
  ) {

    appData.shifts[name] =
      {};

  }


  if (
    shiftName ||
    leaveType
  ) {

    appData.shifts[name][
      dateKey
    ] = {

      shiftName:
        shiftName || "",

      leaveType:
        leaveType || ""

    };

  } else {

    delete appData.shifts[
      name
    ][dateKey];

  }

}


/* ==================================================
   職員名
================================================== */

function getStaffName(
  staff
) {

  if (
    typeof staff ===
    "string"
  ) {

    return staff;

  }


  if (
    staff &&
    typeof staff ===
      "object" &&
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

  const stored =
    getStoredShift(
      staffName,
      dateKey
    );


  const [
    year,
    month,
    day
  ] =
    dateKey
      .split("-")
      .map(Number);


  const current =
    new Date(
      year,
      month - 1,
      day
    );


  const previous =
    new Date(
      current
    );


  previous.setDate(
    previous.getDate() - 1
  );


  const prevKey =
    getDateKey(
      previous.getFullYear(),
      previous.getMonth() + 1,
      previous.getDate()
    );


  const previousShift =
    getStoredShift(
      staffName,
      prevKey
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


  return stored;

}


/* ==================================================
   休暇色
================================================== */

function getLeaveType(
  leaveName
) {

  if (!leaveName) {

    return null;

  }


  return appData.leaveTypes.find(
    leave =>
      String(leave.name) ===
      String(leaveName)
  ) || null;

}


function getLeaveColor(
  leaveName
) {

  const leave =
    getLeaveType(
      leaveName
    );


  if (
    leave &&
    leave.color
  ) {

    return leave.color;

  }


  return "";

}


/* ==================================================
   集計用勤務形態正規化
================================================== */

function normalizeShiftNameForTotal(
  value
) {

  const text =
    String(
      value ?? ""
    ).trim();


  if (!text) {

    return "";

  }


  if (
    text === "明"
  ) {

    return "明";

  }


  const shiftNames =
    Array.isArray(
      appData.shiftTypes
    )

      ? [
          ...new Set(
            appData.shiftTypes
              .map(
                shift =>
                  String(
                    shift?.name ??
                    ""
                  ).trim()
              )
              .filter(
                name =>
                  name &&
                  name !== "明"
              )
          )
        ]

      : [];


  if (
    shiftNames.length === 0
  ) {

    return text;

  }


  const candidates =
    shiftNames
      .filter(
        name =>
          text.startsWith(
            name
          )
      )
      .sort(
        (a, b) =>
          b.length -
          a.length
      );


  if (
    candidates.length === 0
  ) {

    return text;

  }


  const shorterCandidates =
    candidates.filter(
      name =>
        name.length <
        text.length
    );


  if (
    shorterCandidates.length > 0
  ) {

    shorterCandidates.sort(
      (a, b) =>
        b.length -
        a.length
    );


    return shorterCandidates[0];

  }


  return candidates[0];

}


/* ==================================================
   合計列用勤務形態一覧
================================================== */

function getTotalShiftTypes() {

  const result =
    [];

  const seen =
    new Set();


  if (
    !Array.isArray(
      appData.shiftTypes
    )
  ) {

    return result;

  }


  appData.shiftTypes.forEach(
    shift => {

      if (!shift) {

        return;

      }


      const originalName =
        String(
          shift.name ??
          ""
        ).trim();


      if (
        !originalName ||
        originalName === "明"
      ) {

        return;

      }


      const baseName =
        normalizeShiftNameForTotal(
          originalName
        );


      if (
        !baseName ||
        baseName === "明"
      ) {

        return;

      }


      if (
        seen.has(
          baseName
        )
      ) {

        return;

      }


      seen.add(
        baseName
      );


      const exactBase =
        appData.shiftTypes.find(
          item =>
            String(
              item?.name ??
              ""
            ).trim() ===
            baseName
        );


      result.push(
        exactBase ||
        {
          ...shift,
          name:
            baseName
        }
      );

    }
  );


  return result;

}


/* ==================================================
   休暇一覧表示
================================================== */

function renderLeaveLegend() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (!table) {

    return;

  }


  let legend =
    document.getElementById(
      "leaveLegend"
    );


  if (!legend) {

    legend =
      document.createElement(
        "div"
      );

    legend.id =
      "leaveLegend";

    table.parentElement?.appendChild(
      legend
    );

  }


  legend.style.margin =
    "8px 0";

  legend.style.padding =
    "8px 10px";

  legend.style.fontSize =
    "13px";

  legend.style.display =
    "flex";

  legend.style.flexWrap =
    "wrap";

  legend.style.alignItems =
    "center";

  legend.style.gap =
    "8px";

  legend.style.background =
    "#f8f8fa";

  legend.style.borderRadius =
    "10px";


  if (
    !Array.isArray(
      appData.leaveTypes
    ) ||
    appData.leaveTypes.length ===
      0
  ) {

    legend.style.display =
      "none";

    return;

  }


  legend.style.display =
    "flex";


  legend.innerHTML =
    `<strong>🏖️ 休暇一覧</strong>`;


  appData.leaveTypes.forEach(
    leave => {

      const item =
        document.createElement(
          "span"
        );


      item.style.display =
        "inline-flex";

      item.style.alignItems =
        "center";

      item.style.gap =
        "4px";


      const swatch =
        document.createElement(
          "span"
        );


      swatch.style.width =
        "14px";

      swatch.style.height =
        "14px";

      swatch.style.borderRadius =
        "4px";

      swatch.style.background =
        leave.color ||
        "#FFD54F";

      swatch.style.border =
        "1px solid rgba(0,0,0,.12)";


      const text =
        document.createElement(
          "span"
        );

      text.textContent =
        leave.name;


      item.appendChild(
        swatch
      );

      item.appendChild(
        text
      );

      legend.appendChild(
        item
      );

    }
  );

}


/* ==================================================
   勤務表描画
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


  /*
    列幅はここで一元管理。
    固定ヘッダー側も必ず同じ幅を使います。
  */

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


  const totalShiftTypes =
    getTotalShiftTypes();


  let html =
    "";


  /* ==================================================
     COLGROUP
  ================================================== */

  html +=
    "<colgroup>";


  html +=
    `<col class="staff-column"
      style="
        width:${staffColumnWidth}px;
        min-width:${staffColumnWidth}px;
        max-width:${staffColumnWidth}px;
      ">`;


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    html +=
      `<col class="date-column"
        style="
          width:${dateColumnWidth}px;
          min-width:${dateColumnWidth}px;
          max-width:${dateColumnWidth}px;
        ">`;

  }


  totalShiftTypes.forEach(
    () => {

      html +=
        `<col class="total-column"
          style="
            width:${totalColumnWidth}px;
            min-width:${totalColumnWidth}px;
            max-width:${totalColumnWidth}px;
          ">`;

      html +=
        `<col class="total-column"
          style="
            width:${totalColumnWidth}px;
            min-width:${totalColumnWidth}px;
            max-width:${totalColumnWidth}px;
          ">`;

    }
  );


  html +=
    "</colgroup>";


  /* ==================================================
     THEAD
  ================================================== */

  html +=
    "<thead>";


  /* 1段目 */

  html +=
    "<tr>";


  /*
    職員ヘッダー
    横方向だけsticky。
    縦方向は固定レイヤーで別途処理。
  */

  html +=
    `<th
      class="staff-header"
      rowspan="2"
      style="
        width:${staffColumnWidth}px;
        min-width:${staffColumnWidth}px;
        max-width:${staffColumnWidth}px;
        position:sticky;
        left:0;
        z-index:300;
        background:#f2f2f7;
        box-sizing:border-box;
        border-right:1px solid #d1d1d6;
      "
    >職員</th>`;


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


    html +=
      `<th
        class="${cls}"
        rowspan="2"
        style="
          width:${dateColumnWidth}px;
          min-width:${dateColumnWidth}px;
          max-width:${dateColumnWidth}px;
          box-sizing:border-box;
        "
      >
        <span class="day-number">${day}</span><br>
        <span class="day-week">${
          [
            "日",
            "月",
            "火",
            "水",
            "木",
            "金",
            "土"
          ][week]
        }</span>
      </th>`;

  }


  totalShiftTypes.forEach(
    shift => {

      html +=
        `<th
          colspan="2"
          class="shift-header"
        >${escapeHtml(
          shift.name
        )}</th>`;

    }
  );


  html +=
    "</tr>";


  /* 2段目 */

  html +=
    "<tr>";


  totalShiftTypes.forEach(
    () => {

      html +=
        `<th
          class="total-header"
          style="
            width:${totalColumnWidth}px;
            min-width:${totalColumnWidth}px;
            max-width:${totalColumnWidth}px;
            box-sizing:border-box;
          "
        >合計</th>`;

      html +=
        `<th
          class="total-header"
          style="
            width:${totalColumnWidth}px;
            min-width:${totalColumnWidth}px;
            max-width:${totalColumnWidth}px;
            box-sizing:border-box;
          "
        >累計</th>`;

    }
  );


  html +=
    "</tr>";


  html +=
    "</thead>";


  /* ==================================================
     TBODY
  ================================================== */

  html +=
    "<tbody>";


  appData.staff.forEach(
    staff => {

      const staffName =
        getStaffName(
          staff
        );


      html +=
        `<tr
          class="staff-row"
          data-staff-row="${escapeHtml(
            staffName
          )}"
        >`;


      /*
        職員名はここだけsticky。
        top指定をしないことが重要。

        これにより縦スクロール時には
        行と一緒に上へ流れます。
      */

      html +=
        `<th
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
            z-index:200;
            background:#ffffff;
            box-sizing:border-box;
            border-right:1px solid #d1d1d6;
          "
        >${escapeHtml(
          staffName
        )}</th>`;


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


        const leaveName =
          getStoredLeave(
            staffName,
            dateKey
          );


        const leaveColor =
          getLeaveColor(
            leaveName
          );


        const backgroundStyle =
          leaveColor
            ? `background:${escapeHtml(
                leaveColor
              )} !important;`
            : "";


        html +=
          `<td
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
              ${backgroundStyle}
            "
          >${escapeHtml(
            display
          )}</td>`;

      }


      /*
        ★ 合計・累計

        ここは必ず全勤務形態分を
        1セットずつ出します。

        最初の「合計」も通常セルとして
        必ず生成されるため、
        固定レイヤーによって消えません。
      */

      totalShiftTypes.forEach(
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


          html +=
            `<td
              class="total-cell"
              data-total-shift="${escapeHtml(
                shift.name
              )}"
              data-total-type="monthly"
              style="
                width:${totalColumnWidth}px;
                min-width:${totalColumnWidth}px;
                max-width:${totalColumnWidth}px;
                box-sizing:border-box;
              "
            >${monthly}</td>`;


          html +=
            `<td
              class="total-cell"
              data-total-shift="${escapeHtml(
                shift.name
              )}"
              data-total-type="fiscal"
              style="
                width:${totalColumnWidth}px;
                min-width:${totalColumnWidth}px;
                max-width:${totalColumnWidth}px;
                box-sizing:border-box;
              "
            >${fiscal}</td>`;

        }
      );


      html +=
        "</tr>";

    }
  );


  html +=
    "</tbody>";


  /* ==================================================
     テーブル設定
  ================================================== */

  table.style.borderCollapse =
    "separate";

  table.style.borderSpacing =
    "0";

  table.style.tableLayout =
    "fixed";


  const requiredTableWidth =
    staffColumnWidth +
    days * dateColumnWidth +
    totalShiftTypes.length *
      2 *
      totalColumnWidth;


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


  bindScheduleCells();

  bindStaffNameCells();

  renderLeaveLegend();


  /*
    DOM完成後に固定レイヤーを
    完全に作り直します。
  */

  updateScheduleFixedLayers();

}


/* ==================================================
   固定レイヤー作成
================================================== */

function createScheduleFixedLayers() {

  /*
    既存レイヤーを全部削除。
    古い職員名固定レイヤーが残らないようにします。
  */

  if (
    scheduleFixedHeader
  ) {

    scheduleFixedHeader.remove();

  }


  if (
    scheduleFixedStaffColumn
  ) {

    scheduleFixedStaffColumn.remove();

  }


  scheduleFixedHeader =
    null;

  scheduleFixedHeaderTable =
    null;

  scheduleFixedStaffColumn =
    null;

  scheduleFixedStaffTable =
    null;


  /* ==================================================
     日付・合計・累計 固定ヘッダー
  ================================================== */

  scheduleFixedHeader =
    document.createElement(
      "div"
    );


  scheduleFixedHeader.id =
    "scheduleFixedHeader";


  scheduleFixedHeader.style.position =
    "fixed";

  scheduleFixedHeader.style.display =
    "none";

  scheduleFixedHeader.style.zIndex =
    "999";

  scheduleFixedHeader.style.pointerEvents =
    "none";

  scheduleFixedHeader.style.overflow =
    "hidden";

  scheduleFixedHeader.style.boxSizing =
    "border-box";


  scheduleFixedHeaderTable =
    document.createElement(
      "table"
    );


  scheduleFixedHeaderTable.style.borderCollapse =
    "separate";

  scheduleFixedHeaderTable.style.borderSpacing =
    "0";

  scheduleFixedHeaderTable.style.tableLayout =
    "fixed";

  scheduleFixedHeaderTable.style.margin =
    "0";

  scheduleFixedHeaderTable.style.padding =
    "0";

  scheduleFixedHeaderTable.style.position =
    "relative";

  scheduleFixedHeaderTable.style.left =
    "0";

  scheduleFixedHeaderTable.style.top =
    "0";


  scheduleFixedHeader.appendChild(
    scheduleFixedHeaderTable
  );


  document.body.appendChild(
    scheduleFixedHeader
  );


  /* ==================================================
     左上「職員」固定
  ================================================== */

  scheduleFixedStaffColumn =
    document.createElement(
      "div"
    );


  scheduleFixedStaffColumn.id =
    "scheduleFixedStaffColumn";


  scheduleFixedStaffColumn.style.position =
    "fixed";

  scheduleFixedStaffColumn.style.display =
    "none";

  scheduleFixedStaffColumn.style.zIndex =
    "1001";

  scheduleFixedStaffColumn.style.pointerEvents =
    "none";

  scheduleFixedStaffColumn.style.overflow =
    "hidden";

  scheduleFixedStaffColumn.style.boxSizing =
    "border-box";


  scheduleFixedStaffTable =
    document.createElement(
      "table"
    );


  scheduleFixedStaffTable.style.borderCollapse =
    "separate";

  scheduleFixedStaffTable.style.borderSpacing =
    "0";

  scheduleFixedStaffTable.style.tableLayout =
    "fixed";

  scheduleFixedStaffTable.style.margin =
    "0";

  scheduleFixedStaffTable.style.padding =
    "0";

  scheduleFixedStaffTable.style.width =
    "90px";


  scheduleFixedStaffColumn.appendChild(
    scheduleFixedStaffTable
  );


  document.body.appendChild(
    scheduleFixedStaffColumn
  );

}


/* ==================================================
   固定ヘッダー同期
================================================== */

function syncScheduleFixedLayers() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (
    !table ||
    !scheduleFixedHeaderTable ||
    !scheduleFixedStaffTable
  ) {

    return;

  }


  const originalColgroup =
    table.querySelector(
      "colgroup"
    );


  const originalThead =
    table.querySelector(
      "thead"
    );


  const originalStaffHeader =
    table.querySelector(
      "thead .staff-header"
    );


  if (
    !originalColgroup ||
    !originalThead ||
    !originalStaffHeader
  ) {

    return;

  }


  /* ==================================================
     列幅取得
  ================================================== */

  const originalCols =
    Array.from(
      originalColgroup.children
    );


  const colWidths =
    originalCols.map(
      col => {

        const rect =
          col.getBoundingClientRect();


        return rect.width;

      }
    );


  const tableRect =
    table.getBoundingClientRect();


  const tableWidth =
    tableRect.width;


  /* ==================================================
     固定ヘッダーを作り直す
  ================================================== */

  scheduleFixedHeaderTable.innerHTML =
    "";


  const fixedColgroup =
    document.createElement(
      "colgroup"
    );


  originalCols.forEach(
    (col, index) => {

      const fixedCol =
        document.createElement(
          "col"
        );


      const width =
        colWidths[index] ||
        parseFloat(
          col.style.width
        ) ||
        0;


      fixedCol.style.width =
        width + "px";

      fixedCol.style.minWidth =
        width + "px";

      fixedCol.style.maxWidth =
        width + "px";


      fixedColgroup.appendChild(
        fixedCol
      );

    }
  );


  scheduleFixedHeaderTable.appendChild(
    fixedColgroup
  );


  /*
    元のtheadを完全コピー。

    職員セルだけ透明にしますが、
    セル自体は残します。

    これが非常に重要です。

    1列目の90pxを残すことで、
    その後の「1日」「2日」...
    「最初の合計」までの列位置が
    元テーブルと完全一致します。
  */

  const fixedThead =
    originalThead.cloneNode(
      true
    );


  const fixedStaffHeader =
    fixedThead.querySelector(
      ".staff-header"
    );


  if (
    fixedStaffHeader
  ) {

    fixedStaffHeader.style.visibility =
      "hidden";

    fixedStaffHeader.style.background =
      "transparent";

    fixedStaffHeader.style.color =
      "transparent";

    fixedStaffHeader.style.borderColor =
      "transparent";

    fixedStaffHeader.style.pointerEvents =
      "none";

  }


  /*
    固定ヘッダー内の職員セル以外は
    stickyを解除します。

    固定レイヤー自身がfixedなので、
    stickyは不要です。
  */

  fixedThead
    .querySelectorAll(
      "th"
    )
    .forEach(
      th => {

        th.style.position =
          "static";

        th.style.left =
          "auto";

        th.style.top =
          "auto";

      }
    );


  scheduleFixedHeaderTable.appendChild(
    fixedThead
  );


  scheduleFixedHeaderTable.style.width =
    tableWidth + "px";

  scheduleFixedHeaderTable.style.minWidth =
    tableWidth + "px";

  scheduleFixedHeaderTable.style.maxWidth =
    "none";


  /* ==================================================
     左上「職員」だけ作成
  ================================================== */

  scheduleFixedStaffTable.innerHTML =
    "";


  const staffColgroup =
    document.createElement(
      "colgroup"
    );


  const staffCol =
    document.createElement(
      "col"
    );


  const staffWidth =
    originalStaffHeader.getBoundingClientRect().width;


  staffCol.style.width =
    staffWidth + "px";

  staffCol.style.minWidth =
    staffWidth + "px";

  staffCol.style.maxWidth =
    staffWidth + "px";


  staffColgroup.appendChild(
    staffCol
  );


  scheduleFixedStaffTable.appendChild(
    staffColgroup
  );


  const staffThead =
    document.createElement(
      "thead"
    );


  const staffRow =
    document.createElement(
      "tr"
    );


  const staffHeaderClone =
    originalStaffHeader.cloneNode(
      true
    );


  staffHeaderClone.style.position =
    "static";

  staffHeaderClone.style.left =
    "auto";

  staffHeaderClone.style.top =
    "auto";

  staffHeaderClone.style.zIndex =
    "1002";

  staffHeaderClone.style.visibility =
    "visible";

  staffHeaderClone.style.background =
    "#f2f2f7";

  staffHeaderClone.style.color =
    "";

  staffHeaderClone.style.borderRight =
    "1px solid #d1d1d6";


  staffRow.appendChild(
    staffHeaderClone
  );


  staffThead.appendChild(
    staffRow
  );


  scheduleFixedStaffTable.appendChild(
    staffThead
  );


  scheduleFixedStaffTable.style.width =
    staffWidth + "px";

  scheduleFixedStaffTable.style.minWidth =
    staffWidth + "px";

  scheduleFixedStaffTable.style.maxWidth =
    staffWidth + "px";


  /* ==================================================
     行高さ同期
  ================================================== */

  const originalHeaderRows =
    Array.from(
      originalThead.querySelectorAll(
        "tr"
      )
    );


  const fixedHeaderRows =
    Array.from(
      fixedThead.querySelectorAll(
        "tr"
      )
    );


  originalHeaderRows.forEach(
    (row, index) => {

      const fixedRow =
        fixedHeaderRows[index];


      if (!fixedRow) {

        return;

      }


      const height =
        row.getBoundingClientRect().height;


      fixedRow.style.height =
        height + "px";


      Array.from(
        fixedRow.children
      ).forEach(
        cell => {

          cell.style.height =
            height + "px";

        }
      );

    }
  );


  /*
    左上セルは2段分の高さ。
    元の職員ヘッダーはrowspan=2なので
    thead全体の高さを使用します。
  */

  const originalHeaderHeight =
    originalThead.getBoundingClientRect().height;


  staffHeaderClone.style.height =
    originalHeaderHeight + "px";

  staffHeaderClone.style.minHeight =
    originalHeaderHeight + "px";

  staffHeaderClone.style.maxHeight =
    originalHeaderHeight + "px";


  staffRow.style.height =
    originalHeaderHeight + "px";


  scheduleFixedStaffTable.style.height =
    originalHeaderHeight + "px";

}


/* ==================================================
   固定ヘッダー位置更新
================================================== */

function updateScheduleFixedLayers() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (!table) {

    if (
      scheduleFixedHeader
    ) {

      scheduleFixedHeader.style.display =
        "none";

    }


    if (
      scheduleFixedStaffColumn
    ) {

      scheduleFixedStaffColumn.style.display =
        "none";

    }


    return;

  }


  const wrapper =
    table.closest(
      ".table-wrapper"
    );


  const thead =
    table.querySelector(
      "thead"
    );


  const staffHeader =
    table.querySelector(
      "thead .staff-header"
    );


  if (
    !wrapper ||
    !thead ||
    !staffHeader
  ) {

    return;

  }


  if (
    !scheduleFixedHeader ||
    !scheduleFixedStaffColumn
  ) {

    createScheduleFixedLayers();

  }


  /*
    必ず最新DOMと同期
  */

  syncScheduleFixedLayers();


  const wrapperRect =
    wrapper.getBoundingClientRect();


  const tableRect =
    table.getBoundingClientRect();


  const theadRect =
    thead.getBoundingClientRect();


  const staffRect =
    staffHeader.getBoundingClientRect();


  /*
    ページ上部に固定する位置。

    既存アプリの上部ヘッダーがある場合に
    その高さを考慮します。
  */

  let topOffset =
    0;


  const possibleHeaders =
    [
      "header",
      ".app-header",
      ".top-header",
      ".navbar",
      ".header"
    ];


  for (
    const selector of possibleHeaders
  ) {

    const element =
      document.querySelector(
        selector
      );


    if (
      !element ||
      element.id ===
        "scheduleFixedHeader" ||
      element.id ===
        "scheduleFixedStaffColumn"
    ) {

      continue;

    }


    const rect =
      element.getBoundingClientRect();


    if (
      rect.bottom > 0 &&
      rect.bottom <= 180
    ) {

      topOffset =
        Math.max(
          topOffset,
          rect.bottom
        );

    }

  }


  /*
    ヘッダーが画面内にある間は通常ヘッダー。
    画面上部を通過したら固定。
  */

  const originalHeaderTop =
    theadRect.top;


  const originalHeaderHeight =
    theadRect.height;


  const tableBottom =
    tableRect.bottom;


  /*
    まだ通常ヘッダーが
    topOffsetより下にある
  */

  if (
    originalHeaderTop >=
    topOffset
  ) {

    scheduleFixedHeader.style.display =
      "none";

    scheduleFixedStaffColumn.style.display =
      "none";

    return;

  }


  /*
    表そのものが固定ヘッダーより上へ
    完全に抜けたら非表示
  */

  if (
    tableBottom <=
    topOffset
  ) {

    scheduleFixedHeader.style.display =
      "none";

    scheduleFixedStaffColumn.style.display =
      "none";

    return;

  }


  /*
    固定ヘッダーを表示
  */

  scheduleFixedHeader.style.display =
    "block";


  scheduleFixedStaffColumn.style.display =
    "block";


  scheduleFixedHeader.style.left =
    wrapperRect.left + "px";

  scheduleFixedHeader.style.top =
    topOffset + "px";

  scheduleFixedHeader.style.width =
    wrapperRect.width + "px";

  scheduleFixedHeader.style.height =
    originalHeaderHeight + "px";


  /*
    ★ 横スクロール同期

    元テーブルが右へ動いた分だけ
    固定ヘッダーも左へ動かします。

    ただし固定レイヤー自体は
    wrapperの左端に固定。
  */

  const scrollLeft =
    wrapper.scrollLeft || 0;


  scheduleFixedHeaderTable.style.transform =
    `translateX(${-scrollLeft}px)`;


  scheduleFixedHeaderTable.style.webkitTransform =
    `translateX(${-scrollLeft}px)`;


  /*
    左上「職員」

    職員名のtbodyはここに入れません。

    そのため縦スクロールしても
    職員名が固定されることはありません。
  */

  scheduleFixedStaffColumn.style.left =
    wrapperRect.left + "px";

  scheduleFixedStaffColumn.style.top =
    topOffset + "px";

  scheduleFixedStaffColumn.style.width =
    staffRect.width + "px";

  scheduleFixedStaffColumn.style.height =
    originalHeaderHeight + "px";


  scheduleFixedStaffTable.style.transform =
    "translateX(0)";


  scheduleFixedStaffTable.style.webkitTransform =
    "translateX(0)";

}


/* ==================================================
   固定レイヤーイベント
================================================== */

function setupScheduleFixedScrollEvents() {

  /*
    二重登録防止
  */

  if (
    window.__scheduleFixedEventsInstalled
  ) {

    return;

  }


  window.__scheduleFixedEventsInstalled =
    true;


  /*
    ページの縦スクロール

    captureを使って、
    table-wrapper内部のスクロールでも
    位置を更新します。
  */

  window.addEventListener(
    "scroll",
    () => {

      updateScheduleFixedLayers();

    },
    {
      passive: true
    }
  );


  document.addEventListener(
    "scroll",
    e => {

      if (
        e.target &&
        e.target.closest &&
        e.target.closest(
          ".table-wrapper"
        )
      ) {

        updateScheduleFixedLayers();

      }

    },
    {
      passive: true,
      capture: true
    }
  );


  /*
    横スクロール
  */

  document.addEventListener(
    "scroll",
    e => {

      const target =
        e.target;


      if (
        target &&
        target.classList &&
        target.classList.contains(
          "table-wrapper"
        )
      ) {

        updateScheduleFixedLayers();

      }

    },
    {
      passive: true,
      capture: true
    }
  );


  window.addEventListener(
    "resize",
    () => {

      updateScheduleFixedLayers();

    },
    {
      passive: true
    }
  );

}


/* ==================================================
   固定用CSS
================================================== */

function installScheduleFixedCSS() {

  if (
    document.getElementById(
      "scheduleFixedCSS"
    )
  ) {

    return;

  }


  const style =
    document.createElement(
      "style"
    );


  style.id =
    "scheduleFixedCSS";


  style.textContent = `

    /*
      勤務表横スクロール
    */

    .table-wrapper {
      position: relative;
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
    }


    /*
      職員列

      left:0だけを指定。
      topは絶対に指定しない。

      これにより、
      横方向だけ固定され、
      縦方向には行と一緒に動きます。
    */

    #scheduleTable .staff-header {
      position: sticky !important;
      left: 0 !important;
      z-index: 300 !important;
      box-sizing: border-box !important;
      background: #f2f2f7 !important;
    }


    #scheduleTable .staff-name-cell {
      position: sticky !important;
      left: 0 !important;
      z-index: 200 !important;
      box-sizing: border-box !important;
      background: #ffffff !important;
    }


    /*
      勤務セルは職員列より下。
    */

    #scheduleTable .schedule-cell {
      position: relative;
      z-index: 1;
    }


    /*
      固定ヘッダー
    */

    #scheduleFixedHeader {
      box-sizing: border-box !important;
      overflow: hidden !important;
      background: transparent !important;
    }


    #scheduleFixedHeader table {
      border-collapse: separate !important;
      border-spacing: 0 !important;
      table-layout: fixed !important;
      margin: 0 !important;
      padding: 0 !important;
    }


    /*
      左上「職員」
    */

    #scheduleFixedStaffColumn {
      box-sizing: border-box !important;
      overflow: hidden !important;
      background: transparent !important;
    }


    #scheduleFixedStaffColumn table {
      border-collapse: separate !important;
      border-spacing: 0 !important;
      table-layout: fixed !important;
      margin: 0 !important;
      padding: 0 !important;
    }


    #scheduleFixedStaffColumn th {
      box-sizing: border-box !important;
    }


    /*
      固定ヘッダー内ではstickyを使わない。
    */

    #scheduleFixedHeader th {
      position: static !important;
    }

  `;


  document.head.appendChild(
    style
  );

}


/* ==================================================
   勤務表固定機能初期化
================================================== */

function initScheduleFixedSystem() {

  installScheduleFixedCSS();

  setupScheduleFixedScrollEvents();

  updateScheduleFixedLayers();

}


/* ==================================================
   勤務セルイベント
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


            const staffName =
              cell.dataset.staff;


            const dateKey =
              cell.dataset.date;


            showShiftMenu(
              cell,
              staffName,
              dateKey
            );

          }
        );

      }
    );

}


/* ==================================================
   職員名セル
================================================== */

function bindStaffNameCells() {

  document
    .querySelectorAll(
      ".staff-name-cell"
    )
    .forEach(
      cell => {

        cell.addEventListener(
          "click",
          e => {

            e.stopPropagation();


            const staffName =
              cell.dataset.staff;


            openCalendarModal(
              staffName
            );

          }
        );

      }
    );

}


/* ==================================================
   勤務メニュー
================================================== */

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


  selectedCell =
    {
      cell,
      staffName,
      dateKey
    };


  shiftMenuMode =
    "shift";


  const buttons =
    document.getElementById(
      "shiftMenuButtons"
    );


  if (!buttons) {

    return;

  }


  buttons.innerHTML =
    "";


  /*
    勤務形態
  */

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
        () => {

          saveWorkShift(
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


  /*
    削除
  */

  const deleteButton =
    document.createElement(
      "button"
    );


  deleteButton.type =
    "button";

  deleteButton.textContent =
    "削除";


  deleteButton.style.gridColumn =
    "1 / -1";

  deleteButton.style.width =
    "100%";

  deleteButton.style.background =
    "#f3e5f5";

  deleteButton.style.color =
    "#7b1fa2";

  deleteButton.style.fontWeight =
    "700";


  deleteButton.addEventListener(
    "click",
    () => {

      saveWorkShift(
        staffName,
        dateKey,
        ""
      );

    }
  );


  buttons.appendChild(
    deleteButton
  );


  /*
    休暇
  */

  const leaveButton =
    document.createElement(
      "button"
    );


  leaveButton.type =
    "button";

  leaveButton.textContent =
    "休暇";


  leaveButton.style.gridColumn =
    "1 / -1";

  leaveButton.style.width =
    "100%";

  leaveButton.style.background =
    "#e8f5e9";

  leaveButton.style.color =
    "#2e7d32";

  leaveButton.style.fontWeight =
    "700";


  leaveButton.addEventListener(
    "click",
    () => {

      showLeaveMenu();

    }
  );


  buttons.appendChild(
    leaveButton
  );


  /*
    キャンセル
  */

  const cancelButton =
    document.createElement(
      "button"
    );


  cancelButton.type =
    "button";

  cancelButton.textContent =
    "キャンセル";


  cancelButton.style.gridColumn =
    "1 / -1";

  cancelButton.style.width =
    "100%";

  cancelButton.style.background =
    "#ffebee";

  cancelButton.style.color =
    "#c62828";

  cancelButton.style.fontWeight =
    "700";


  cancelButton.addEventListener(
    "click",
    hideShiftMenu
  );


  buttons.appendChild(
    cancelButton
  );


  positionShiftMenu(
    cell,
    menu
  );


  menu.style.display =
    "block";

}


/* ==================================================
   休暇メニュー
================================================== */

function showLeaveMenu() {

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
    !buttons ||
    !selectedCell
  ) {

    return;

  }


  shiftMenuMode =
    "leave";


  buttons.innerHTML =
    "";


  appData.leaveTypes.forEach(
    leave => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "shift-menu-button";


      button.textContent =
        leave.name;


      button.style.background =
        leave.color ||
        "#FFD54F";


      button.style.color =
        getTextColorForBackground(
          leave.color
        );


      button.addEventListener(
        "click",
        () => {

          saveLeave(
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


  /*
    休暇解除
  */

  const clearButton =
    document.createElement(
      "button"
    );


  clearButton.type =
    "button";

  clearButton.textContent =
    "休暇解除";


  clearButton.style.gridColumn =
    "1 / -1";

  clearButton.style.width =
    "100%";

  clearButton.style.background =
    "#eeeeee";

  clearButton.style.color =
    "#333";

  clearButton.style.fontWeight =
    "700";


  clearButton.addEventListener(
    "click",
    () => {

      saveLeave(
        selectedCell.staffName,
        selectedCell.dateKey,
        ""
      );

    }
  );


  buttons.appendChild(
    clearButton
  );


  /*
    戻る
  */

  const backButton =
    document.createElement(
      "button"
    );


  backButton.type =
    "button";

  backButton.textContent =
    "勤務形態に戻る";


  backButton.style.gridColumn =
    "1 / -1";

  backButton.style.width =
    "100%";

  backButton.style.background =
    "#eeeeee";

  backButton.style.color =
    "#333";


  backButton.addEventListener(
    "click",
    () => {

      if (
        selectedCell
      ) {

        showShiftMenu(
          selectedCell.cell,
          selectedCell.staffName,
          selectedCell.dateKey
        );

      }

    }
  );


  buttons.appendChild(
    backButton
  );


  /*
    キャンセル
  */

  const cancelButton =
    document.createElement(
      "button"
    );


  cancelButton.type =
    "button";

  cancelButton.textContent =
    "キャンセル";


  cancelButton.style.gridColumn =
    "1 / -1";

  cancelButton.style.width =
    "100%";

  cancelButton.style.background =
    "#ffebee";

  cancelButton.style.color =
    "#c62828";


  cancelButton.addEventListener(
    "click",
    hideShiftMenu
  );


  buttons.appendChild(
    cancelButton
  );


  positionShiftMenu(
    selectedCell.cell,
    menu
  );


  menu.style.display =
    "block";

}


/* ==================================================
   メニュー位置
================================================== */

function positionShiftMenu(
  cell,
  menu
) {

  const rect =
    cell.getBoundingClientRect();


  menu.style.position =
    "fixed";


  menu.style.visibility =
    "hidden";

  menu.style.display =
    "block";


  const menuRect =
    menu.getBoundingClientRect();


  let left =
    rect.left;


  let top =
    rect.bottom + 4;


  if (
    left + menuRect.width >
    window.innerWidth - 8
  ) {

    left =
      window.innerWidth -
      menuRect.width -
      8;

  }


  if (
    left < 8
  ) {

    left =
      8;

  }


  if (
    top + menuRect.height >
    window.innerHeight - 8
  ) {

    top =
      rect.top -
      menuRect.height -
      4;

  }


  if (
    top < 8
  ) {

    top =
      8;

  }


  menu.style.left =
    left + "px";

  menu.style.top =
    top + "px";

  menu.style.visibility =
    "visible";

}


/* ==================================================
   メニュー非表示
================================================== */

function hideShiftMenu() {

  const menu =
    document.getElementById(
      "shiftMenu"
    );


  if (menu) {

    menu.style.display =
      "none";

  }


  selectedCell =
    null;


  shiftMenuMode =
    "shift";

}


/* ==================================================
   勤務保存
================================================== */

async function saveWorkShift(
  staffName,
  dateKey,
  shiftName
) {

  if (
    !supabaseClient
  ) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const existingResult =
      await supabaseClient
        .from("work_shifts")
        .select(
          "id,shift_name,leave_type"
        )
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          dateKey
        )
        .maybeSingle();


    if (
      existingResult.error
    ) {

      throw existingResult.error;

    }


    const existing =
      existingResult.data;


    /*
      勤務削除

      休暇がある場合は、
      勤務だけ消して休暇は残す。
    */

    if (
      !shiftName
    ) {

      if (existing) {

        if (
          existing.leave_type
        ) {

          const result =
            await supabaseClient
              .from("work_shifts")
              .update({

                shift_name:
                  ""

              })
              .eq(
                "id",
                existing.id
              );


          if (result.error) {

            throw result.error;

          }

        } else {

          const result =
            await supabaseClient
              .from("work_shifts")
              .delete()
              .eq(
                "id",
                existing.id
              );


          if (result.error) {

            throw result.error;

          }

        }

      }


      setStoredShift(
        staffName,
        dateKey,
        "",
        existing?.leave_type || ""
      );


      hideShiftMenu();

      renderSchedule();

      return;

    }


    /*
      勤務変更

      既存休暇はそのまま残す。
    */

    if (existing) {

      const result =
        await supabaseClient
          .from("work_shifts")
          .update({

            shift_name:
              shiftName

          })
          .eq(
            "id",
            existing.id
          );


      if (result.error) {

        throw result.error;

      }


      setStoredShift(
        staffName,
        dateKey,
        shiftName,
        existing.leave_type || ""
      );

    } else {

      const result =
        await supabaseClient
          .from("work_shifts")
          .insert({

            staff_name:
              staffName,

            work_date:
              dateKey,

            shift_name:
              shiftName,

            leave_type:
              null

          });


      if (result.error) {

        throw result.error;

      }


      setStoredShift(
        staffName,
        dateKey,
        shiftName,
        ""
      );

    }


    saveLocalData();

    hideShiftMenu();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務保存エラー",
      error
    );


    alert(
      "勤務を保存できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   休暇保存
================================================== */

async function saveLeave(
  staffName,
  dateKey,
  leaveName
) {

  if (
    !supabaseClient
  ) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const existingResult =
      await supabaseClient
        .from("work_shifts")
        .select(
          "id,shift_name,leave_type"
        )
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          dateKey
        )
        .maybeSingle();


    if (
      existingResult.error
    ) {

      throw existingResult.error;

    }


    const existing =
      existingResult.data;


    if (
      !leaveName
    ) {

      if (existing) {

        if (
          existing.shift_name
        ) {

          const result =
            await supabaseClient
              .from("work_shifts")
              .update({

                leave_type:
                  null

              })
              .eq(
                "id",
                existing.id
              );


          if (result.error) {

            throw result.error;

          }

        } else {

          const result =
            await supabaseClient
              .from("work_shifts")
              .delete()
              .eq(
                "id",
                existing.id
              );


          if (result.error) {

            throw result.error;

          }

        }

      }


      setStoredShift(
        staffName,
        dateKey,
        existing?.shift_name || "",
        ""
      );


    } else {

      if (existing) {

        const result =
          await supabaseClient
            .from("work_shifts")
            .update({

              leave_type:
                leaveName

            })
            .eq(
              "id",
              existing.id
            );


        if (result.error) {

          throw result.error;

        }


        setStoredShift(
          staffName,
          dateKey,
          existing.shift_name || "",
          leaveName
        );

      } else {

        const result =
          await supabaseClient
            .from("work_shifts")
            .insert({

              staff_name:
                staffName,

              work_date:
                dateKey,

              shift_name:
                "",

              leave_type:
                leaveName

            });


        if (result.error) {

          throw result.error;

        }


        setStoredShift(
          staffName,
          dateKey,
          "",
          leaveName
        );

      }

    }


    saveLocalData();

    hideShiftMenu();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇保存エラー",
      error
    );


    alert(
      "休暇を保存できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   背景色に対する文字色
================================================== */

function getTextColorForBackground(
  color
) {

  if (!color) {

    return "#000000";

  }


  let hex =
    String(
      color
    ).replace(
      "#",
      ""
    );


  if (
    hex.length === 3
  ) {

    hex =
      hex
        .split("")
        .map(
          c =>
            c + c
        )
        .join("");

  }


  if (
    hex.length !== 6
  ) {

    return "#000000";

  }


  const r =
    parseInt(
      hex.substring(0, 2),
      16
    );


  const g =
    parseInt(
      hex.substring(2, 4),
      16
    );


  const b =
    parseInt(
      hex.substring(4, 6),
      16
    );


  const brightness =
    (
      r * 299 +
      g * 587 +
      b * 114
    ) / 1000;


  return brightness > 155
    ? "#000000"
    : "#ffffff";

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


  let count =
    0;


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


    const stored =
      getStoredShift(
        staffName,
        dateKey
      );


    const normalized =
      normalizeShiftNameForTotal(
        stored
      );


    if (
      normalized ===
      shiftName
    ) {

      count++;

    }

  }


  return count;

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

  /*
    4月始まり。

    1～3月なら前年4月～当年3月。
    4～12月なら当年4月～翌年3月。
  */

  const fiscalStartYear =
    month >= 4
      ? year
      : year - 1;


  let count =
    0;


  for (
    let offset = 0;
    offset < 12;
    offset++
  ) {

    const date =
      new Date(
        fiscalStartYear,
        3 + offset,
        1
      );


    const targetYear =
      date.getFullYear();

    const targetMonth =
      date.getMonth() + 1;


    const days =
      getDaysInMonth(
        targetYear,
        targetMonth
      );


    for (
      let day = 1;
      day <= days;
      day++
    ) {

      const dateKey =
        getDateKey(
          targetYear,
          targetMonth,
          day
        );


      const stored =
        getStoredShift(
          staffName,
          dateKey
        );


      const normalized =
        normalizeShiftNameForTotal(
          stored
        );


      if (
        normalized ===
        shiftName
      ) {

        count++;

      }

    }

  }


  return count;

}


/* ==================================================
   職員追加・更新
================================================== */

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


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (
      editingStaffIndex >= 0 &&
      appData.staff[
        editingStaffIndex
      ]
    ) {

      const staff =
        appData.staff[
          editingStaffIndex
        ];


      const oldName =
        staff.name;


      const result =
        await supabaseClient
          .from("staff")
          .update({

            name:
              name

          })
          .eq(
            "id",
            staff.id
          );


      if (result.error) {

        throw result.error;

      }


      /*
        勤務データ側の職員名も変更
      */

      const shiftData =
        appData.shifts[
          oldName
        ] || {};


      const dates =
        Object.keys(
          shiftData
        );


      for (
        const dateKey of dates
      ) {

        const data =
          shiftData[
            dateKey
          ];


        const result2 =
          await supabaseClient
            .from("work_shifts")
            .update({

              staff_name:
                name

            })
            .eq(
              "staff_name",
              oldName
            )
            .eq(
              "work_date",
              dateKey
            );


        if (result2.error) {

          throw result2.error;

        }

      }


    } else {

      const maxSort =
        appData.staff.reduce(
          (max, staff) =>
            Math.max(
              max,
              Number.isFinite(
                Number(
                  staff.sort_order
                )
              )
                ? Number(
                    staff.sort_order
                  )
                : 0
            ),
          0
        );


      const result =
        await supabaseClient
          .from("staff")
          .insert({

            name:
              name,

            sort_order:
              maxSort + 1

          });


      if (result.error) {

        throw result.error;

      }

    }


    editingStaffIndex =
      -1;


    input.value =
      "";


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "職員保存エラー",
      error
    );


    alert(
      "職員を保存できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   職員削除
================================================== */

async function deleteStaff(
  index
) {

  const staff =
    appData.staff[index];


  if (!staff) {

    return;

  }


  if (
    !confirm(
      `${staff.name}を削除しますか？`
    )
  ) {

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
        .from("staff")
        .delete()
        .eq(
          "id",
          staff.id
        );


    if (result.error) {

      throw result.error;

    }


    await supabaseClient
      .from("work_shifts")
      .delete()
      .eq(
        "staff_name",
        staff.name
      );


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "職員削除エラー",
      error
    );


    alert(
      "職員を削除できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   職員並び替え
================================================== */

async function moveStaff(
  index,
  direction
) {

  const targetIndex =
    index + direction;


  if (
    index < 0 ||
    targetIndex < 0 ||
    targetIndex >=
      appData.staff.length
  ) {

    return;

  }


  const current =
    appData.staff[index];


  const target =
    appData.staff[targetIndex];


  if (
    !current ||
    !target
  ) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const currentSort =
      Number.isFinite(
        Number(
          current.sort_order
        )
      )
        ? Number(
            current.sort_order
          )
        : index + 1;


    const targetSort =
      Number.isFinite(
        Number(
          target.sort_order
        )
      )
        ? Number(
            target.sort_order
          )
        : targetIndex + 1;


    const r1 =
      await supabaseClient
        .from("staff")
        .update({

          sort_order:
            targetSort

        })
        .eq(
          "id",
          current.id
        );


    if (r1.error) {

      throw r1.error;

    }


    const r2 =
      await supabaseClient
        .from("staff")
        .update({

          sort_order:
            currentSort

        })
        .eq(
          "id",
          target.id
        );


    if (r2.error) {

      throw r2.error;

    }


    await loadAllFromSupabase();

    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "職員並び替えエラー",
      error
    );


    alert(
      "並び替えに失敗しました。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   職員一覧
================================================== */

function renderStaffList() {

  const container =
    document.getElementById(
      "staffList"
    );


  if (!container) {

    return;

  }


  container.innerHTML =
    "";


  appData.staff.forEach(
    (staff, index) => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "staff-list-row";


      row.innerHTML =
        `
          <span class="staff-list-name">
            ${escapeHtml(
              staff.name
            )}
          </span>

          <button
            type="button"
            onclick="moveStaff(${index}, -1)"
          >↑</button>

          <button
            type="button"
            onclick="moveStaff(${index}, 1)"
          >↓</button>

          <button
            type="button"
            onclick="editStaff(${index})"
          >編集</button>

          <button
            type="button"
            onclick="deleteStaff(${index})"
          >削除</button>
        `;


      container.appendChild(
        row
      );

    }
  );

}


/* ==================================================
   職員編集
================================================== */

function editStaff(
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


  if (!input) {

    return;

  }


  editingStaffIndex =
    index;


  input.value =
    staff.name;


  input.focus();

}


/* ==================================================
   勤務形態追加・更新
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


  if (!name) {

    alert(
      "勤務形態名を入力してください。"
    );

    return;

  }


  if (
    name === "明"
  ) {

    alert(
      "「明」は自動表示用のため登録できません。"
    );

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const payload = {

      name:
        name,

      start_time:
        startInput?.value ||
        null,

      end_time:
        endInput?.value ||
        null,

      break_time:
        breakInput?.value ||
        null

    };


    if (
      editingShiftIndex >= 0 &&
      appData.shiftTypes[
        editingShiftIndex
      ]
    ) {

      const shift =
        appData.shiftTypes[
          editingShiftIndex
        ];


      const result =
        await supabaseClient
          .from("shift_types")
          .update(
            payload
          )
          .eq(
            "id",
            shift.id
          );


      if (result.error) {

        throw result.error;

      }

    } else {

      const result =
        await supabaseClient
          .from("shift_types")
          .insert(
            payload
          );


      if (result.error) {

        throw result.error;

      }

    }


    editingShiftIndex =
      -1;


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

    renderAll();


  } catch (error) {

    console.error(
      "勤務形態保存エラー",
      error
    );


    alert(
      "勤務形態を保存できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   勤務形態編集
================================================== */

function editShift(
  index
) {

  const shift =
    appData.shiftTypes[index];


  if (!shift) {

    return;

  }


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


  editingShiftIndex =
    index;


  if (nameInput) {

    nameInput.value =
      shift.name;

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

}


/* ==================================================
   勤務形態削除
================================================== */

async function deleteShift(
  index
) {

  const shift =
    appData.shiftTypes[index];


  if (!shift) {

    return;

  }


  if (
    !confirm(
      `${shift.name}を削除しますか？`
    )
  ) {

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
        .delete()
        .eq(
          "id",
          shift.id
        );


    if (result.error) {

      throw result.error;

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "勤務形態削除エラー",
      error
    );


    alert(
      "勤務形態を削除できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   勤務形態一覧
================================================== */

function renderShiftList() {

  const container =
    document.getElementById(
      "shiftList"
    );


  if (!container) {

    return;

  }


  container.innerHTML =
    "";


  appData.shiftTypes.forEach(
    (shift, index) => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "shift-list-row";


      row.innerHTML =
        `
          <span>
            ${escapeHtml(
              shift.name
            )}
          </span>

          <span>
            ${escapeHtml(
              shift.start || ""
            )}
            ～ 
            ${escapeHtml(
              shift.end || ""
            )}
          </span>

          <button
            type="button"
            onclick="editShift(${index})"
          >編集</button>

          <button
            type="button"
            onclick="deleteShift(${index})"
          >削除</button>
        `;


      container.appendChild(
        row
      );

    }
  );

}


/* ==================================================
   休暇追加・更新
================================================== */

async function addOrUpdateLeave() {

  const nameInput =
    document.getElementById(
      "leaveNameInput"
    );


  const colorInput =
    document.getElementById(
      "leaveColorInput"
    );


  if (!nameInput) {

    return;

  }


  const name =
    nameInput.value.trim();


  const color =
    colorInput?.value ||
    "#FFD54F";


  if (!name) {

    alert(
      "休暇名を入力してください。"
    );

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (
      editingLeaveId
    ) {

      const result =
        await supabaseClient
          .from("leave_types")
          .update({

            name:
              name,

            color:
              color

          })
          .eq(
            "id",
            editingLeaveId
          );


      if (result.error) {

        throw result.error;

      }

    } else {

      const result =
        await supabaseClient
          .from("leave_types")
          .insert({

            name:
              name,

            color:
              color

          });


      if (result.error) {

        throw result.error;

      }

    }


    editingLeaveId =
      null;


    nameInput.value =
      "";


    if (colorInput) {

      colorInput.value =
        "#FFD54F";

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "休暇保存エラー",
      error
    );


    alert(
      "休暇を保存できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   休暇編集
================================================== */

function editLeave(
  id
) {

  const leave =
    appData.leaveTypes.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!leave) {

    return;

  }


  const nameInput =
    document.getElementById(
      "leaveNameInput"
    );


  const colorInput =
    document.getElementById(
      "leaveColorInput"
    );


  editingLeaveId =
    leave.id;


  if (nameInput) {

    nameInput.value =
      leave.name;

  }


  if (colorInput) {

    colorInput.value =
      leave.color ||
      "#FFD54F";

  }

}


/* ==================================================
   休暇削除
================================================== */

async function deleteLeave(
  id
) {

  const leave =
    appData.leaveTypes.find(
      item =>
        String(item.id) ===
        String(id)
    );


  if (!leave) {

    return;

  }


  if (
    !confirm(
      `${leave.name}を削除しますか？`
    )
  ) {

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
        .from("leave_types")
        .delete()
        .eq(
          "id",
          leave.id
        );


    if (result.error) {

      throw result.error;

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "休暇削除エラー",
      error
    );


    alert(
      "休暇を削除できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   休暇一覧
================================================== */

function renderLeaveList() {

  const container =
    document.getElementById(
      "leaveList"
    );


  if (!container) {

    return;

  }


  container.innerHTML =
    "";


  appData.leaveTypes.forEach(
    leave => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "leave-list-row";


      row.innerHTML =
        `
          <span
            style="
              display:inline-flex;
              align-items:center;
              gap:8px;
            "
          >
            <span
              style="
                width:18px;
                height:18px;
                border-radius:4px;
                background:${escapeHtml(
                  leave.color ||
                  "#FFD54F"
                )};
                border:1px solid rgba(0,0,0,.15);
              "
            ></span>

            <span>
              ${escapeHtml(
                leave.name
              )}
            </span>
          </span>

          <button
            type="button"
            onclick="editLeave('${escapeHtml(
              leave.id
            )}')"
          >編集</button>

          <button
            type="button"
            onclick="deleteLeave('${escapeHtml(
              leave.id
            )}')"
          >削除</button>
        `;


      container.appendChild(
        row
      );

    }
  );

}


/* ==================================================
   会社休業日追加
================================================== */

async function addCompanyHoliday() {

  const nameInput =
    document.getElementById(
      "companyHolidayNameInput"
    );


  const startInput =
    document.getElementById(
      "companyHolidayStartInput"
    );


  const endInput =
    document.getElementById(
      "companyHolidayEndInput"
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
    endInput?.value ||
    start;


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
    end < start
  ) {

    alert(
      "終了日は開始日以降にしてください。"
    );

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const payload = {

      name:
        name,

      start_date:
        start,

      end_date:
        end

    };


    if (
      editingHolidayId
    ) {

      const result =
        await supabaseClient
          .from("company_holidays")
          .update(
            payload
          )
          .eq(
            "id",
            editingHolidayId
          );


      if (result.error) {

        throw result.error;

      }

    } else {

      const result =
        await supabaseClient
          .from("company_holidays")
          .insert(
            payload
          );


      if (result.error) {

        throw result.error;

      }

    }


    editingHolidayId =
      null;


    nameInput.value =
      "";

    startInput.value =
      "";

    if (endInput) {

      endInput.value =
        "";

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "会社休業日保存エラー",
      error
    );


    alert(
      "会社休業日を保存できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   会社休業日編集
================================================== */

function editCompanyHoliday(
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
      "companyHolidayNameInput"
    );


  const startInput =
    document.getElementById(
      "companyHolidayStartInput"
    );


  const endInput =
    document.getElementById(
      "companyHolidayEndInput"
    );


  editingHolidayId =
    holiday.id;


  if (nameInput) {

    nameInput.value =
      holiday.name;

  }


  if (startInput) {

    startInput.value =
      holiday.start;

  }


  if (endInput) {

    endInput.value =
      holiday.end;

  }

}


/* ==================================================
   会社休業日削除
================================================== */

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


  if (
    !confirm(
      `${holiday.name}を削除しますか？`
    )
  ) {

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
          holiday.id
        );


    if (result.error) {

      throw result.error;

    }


    await loadAllFromSupabase();

    renderAll();


  } catch (error) {

    console.error(
      "会社休業日削除エラー",
      error
    );


    alert(
      "会社休業日を削除できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   会社休業日一覧
================================================== */

function renderHolidayList() {

  const container =
    document.getElementById(
      "holidayList"
    );


  if (!container) {

    return;

  }


  container.innerHTML =
    "";


  appData.companyHolidays.forEach(
    holiday => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "holiday-list-row";


      row.innerHTML =
        `
          <span>
            ${escapeHtml(
              holiday.name
            )}
          </span>

          <span>
            ${escapeHtml(
              holiday.start
            )}
            ～ 
            ${escapeHtml(
              holiday.end
            )}
          </span>

          <button
            type="button"
            onclick="editCompanyHoliday('${escapeHtml(
              holiday.id
            )}')"
          >編集</button>

          <button
            type="button"
            onclick="deleteCompanyHoliday('${escapeHtml(
              holiday.id
            )}')"
          >削除</button>
        `;


      container.appendChild(
        row
      );

    }
  );

}


/* ==================================================
   明の時間設定保存
================================================== */

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
    startInput.value ||
    "05:30";


  const end =
    endInput.value ||
    "11:15";


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const startResult =
      await supabaseClient
        .from("app_settings")
        .upsert(
          {
            setting_name:
              "ake_start",

            setting_value:
              start
          },
          {
            onConflict:
              "setting_name"
          }
        );


    if (
      startResult.error
    ) {

      throw startResult.error;

    }


    const endResult =
      await supabaseClient
        .from("app_settings")
        .upsert(
          {
            setting_name:
              "ake_end",

            setting_value:
              end
          },
          {
            onConflict:
              "setting_name"
          }
        );


    if (
      endResult.error
    ) {

      throw endResult.error;

    }


    appData.akeTime = {

      start:
        start,

      end:
        end

    };


    saveLocalData();


    alert(
      "明の時間を保存しました。"
    );


  } catch (error) {

    console.error(
      "明時間保存エラー",
      error
    );


    alert(
      "明の時間を保存できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   カレンダーモーダル
================================================== */

function openCalendarModal(
  staffName
) {

  const modal =
    document.getElementById(
      "calendarModal"
    );


  const nameElement =
    document.getElementById(
      "calendarStaffName"
    );


  if (!modal) {

    return;

  }


  modal.dataset.staffName =
    staffName;


  if (nameElement) {

    nameElement.textContent =
      staffName;

  }


  modal.style.display =
    "flex";

}


/* ==================================================
   webcal登録
================================================== */

function subscribeStaffCalendar() {

  const modal =
    document.getElementById(
      "calendarModal"
    );


  if (!modal) {

    return;

  }


  const staffName =
    modal.dataset.staffName;


  if (!staffName) {

    return;

  }


  const staff =
    appData.staff.find(
      item =>
        item.name ===
        staffName
    );


  if (
    !staff ||
    !staff.calendar_token
  ) {

    alert(
      "この職員のカレンダートークンがありません。"
    );

    return;

  }


  /*
    ★ ICSダウンロードにはしない。

    必ずwebcal://で登録する。
  */

  const baseUrl =
    SUPABASE_URL.replace(
      /^https?:\/\//,
      ""
    );


  const webcalUrl =
    "webcal://" +
    baseUrl +
    "/functions/v1/staff-calendar?token=" +
    encodeURIComponent(
      staff.calendar_token
    );


  window.location.href =
    webcalUrl;

}


/* ==================================================
   カレンダーモーダル閉じる
================================================== */

function closeCalendarModal() {

  const modal =
    document.getElementById(
      "calendarModal"
    );


  if (modal) {

    modal.style.display =
      "none";

  }

}


/* ==================================================
   今月削除
================================================== */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth() + 1;


  if (
    !confirm(
      `${year}年${month}月の勤務を削除しますか？`
    )
  ) {

    return;

  }


  if (!supabaseClient) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

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


    await loadAllFromSupabase();

    renderSchedule();


  } catch (error) {

    console.error(
      "今月削除エラー",
      error
    );


    alert(
      "今月の勤務を削除できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   年度削除
================================================== */

async function deleteFiscalYear() {

  const currentYear =
    currentDate.getFullYear();

  const currentMonth =
    currentDate.getMonth() + 1;


  const fiscalStartYear =
    currentMonth >= 4
      ? currentYear
      : currentYear - 1;


  const start =
    getDateKey(
      fiscalStartYear,
      4,
      1
    );


  const end =
    getDateKey(
      fiscalStartYear + 1,
      3,
      31
    );


  if (
    !confirm(
      `${fiscalStartYear}年度の勤務をすべて削除しますか？`
    )
  ) {

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


    await loadAllFromSupabase();

    renderSchedule();


  } catch (error) {

    console.error(
      "年度削除エラー",
      error
    );


    alert(
      "年度の勤務を削除できませんでした。"
    );

  } finally {

    finishCloudOperation();

  }

}


/* ==================================================
   日本の祝日読み込み
================================================== */

async function loadPublicHolidays() {

  try {

    const response =
      await fetch(
        "https://holidays-jp.github.io/api/v1/date.json"
      );


    if (!response.ok) {

      throw new Error(
        "祝日API取得失敗"
      );

    }


    publicHolidays =
      await response.json();


    renderSchedule();


  } catch (error) {

    console.error(
      "祝日読み込みエラー",
      error
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
   ICS関連
   ※webcal登録を維持するため、
   既存機能として残します。
================================================== */

function exportCalendar(
  staffName
) {

  const events =
    [];


  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth() + 1;


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


    const shift =
      getDisplayShift(
        staffName,
        dateKey
      );


    if (!shift) {

      continue;

    }


    events.push(
      createAllDayEvent(
        dateKey,
        shift,
        getOtherStaffDescription(
          staffName,
          dateKey
        )
      )
    );

  }


  const ics =
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//WorkScheduleApp//JP//EN",
      "CALSCALE:GREGORIAN",
      ...events,
      "END:VCALENDAR"
    ].join(
      "\r\n"
    );


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
    `${staffName}-${year}-${String(month).padStart(2, "0")}.ics`;


  document.body.appendChild(
    a
  );


  a.click();


  a.remove();


  URL.revokeObjectURL(
    url
  );

}


/* ==================================================
   終日イベント
================================================== */

function createAllDayEvent(
  dateKey,
  summary,
  description
) {

  const nextDate =
    addOneDay(
      dateKey
    );


  return [
    "BEGIN:VEVENT",

    "UID:" +
      escapeICS(
        `${dateKey}-${summary}-${Math.random()}`
      ),

    "DTSTAMP:" +
      utcNow(),

    "DTSTART;VALUE=DATE:" +
      dateKey.replace(
        /-/g,
        ""
      ),

    "DTEND;VALUE=DATE:" +
      nextDate.replace(
        /-/g,
        ""
      ),

    "SUMMARY:" +
      escapeICS(
        summary
      ),

    "DESCRIPTION:" +
      escapeICS(
        description || ""
      ),

    "END:VEVENT"

  ].join(
    "\r\n"
  );

}


/* ==================================================
   時間指定イベント
================================================== */

function createTimedEvent(
  dateKey,
  summary,
  startTime,
  endTime,
  description
) {

  return [
    "BEGIN:VEVENT",

    "UID:" +
      escapeICS(
        `${dateKey}-${summary}-${Math.random()}`
      ),

    "DTSTAMP:" +
      utcNow(),

    "DTSTART:" +
      makeDateTime(
        dateKey,
        startTime
      ),

    "DTEND:" +
      makeDateTime(
        dateKey,
        endTime
      ),

    "SUMMARY:" +
      escapeICS(
        summary
      ),

    "DESCRIPTION:" +
      escapeICS(
        description || ""
      ),

    "END:VEVENT"

  ].join(
    "\r\n"
  );

}


/* ==================================================
   日時作成
================================================== */

function makeDateTime(
  dateKey,
  time
) {

  const [
    hour,
    minute
  ] =
    String(
      time || "00:00"
    )
      .split(":")
      .map(Number);


  const [
    year,
    month,
    day
  ] =
    dateKey
      .split("-")
      .map(Number);


  const date =
    new Date(
      year,
      month - 1,
      day,
      hour,
      minute,
      0
    );


  return formatUTC(
    date
  );

}


/* ==================================================
   UTCフォーマット
================================================== */

function formatUTC(
  date
) {

  const y =
    date.getUTCFullYear();


  const m =
    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const d =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );


  const h =
    String(
      date.getUTCHours()
    ).padStart(
      2,
      "0"
    );


  const min =
    String(
      date.getUTCMinutes()
    ).padStart(
      2,
      "0"
    );


  const s =
    String(
      date.getUTCSeconds()
    ).padStart(
      2,
      "0"
    );


  return (
    `${y}${m}${d}T${h}${min}${s}Z`
  );

}


/* ==================================================
   現在UTC
================================================== */

function utcNow() {

  return formatUTC(
    new Date()
  );

}


/* ==================================================
   1日追加
================================================== */

function addOneDay(
  dateKey
) {

  const [
    year,
    month,
    day
  ] =
    dateKey
      .split("-")
      .map(Number);


  const date =
    new Date(
      year,
      month - 1,
      day
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
   他職員の勤務説明
================================================== */

function getOtherStaffDescription(
  staffName,
  dateKey
) {

  const lines =
    [];


  appData.staff.forEach(
    staff => {

      const name =
        getStaffName(
          staff
        );


      if (
        name ===
        staffName
      ) {

        return;

      }


      const shift =
        getDisplayShift(
          name,
          dateKey
        );


      if (shift) {

        lines.push(
          `${name}: ${shift}`
        );

      }

    }
  );


  return lines.join(
    "\n"
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


/* ==================================================
   初期化後に固定機能を有効化
================================================== */

setTimeout(
  () => {

    initScheduleFixedSystem();

  },
  0
);
