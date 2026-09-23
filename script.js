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


/* ==================================================
   メニュー状態
================================================== */

let shiftMenuMode =
  "shift";


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


    bindEvents();


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


  /* ==================================================
     職員
  ================================================== */

  const staffResult =
    await supabaseClient
      .from("staff")
      .select(
        "id,name,created_at,sort_order,calendar_token"
      );


  if (staffResult.error) {

    throw staffResult.error;

  }


  /* ==================================================
     勤務形態
  ================================================== */

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


  /* ==================================================
     勤務
  ================================================== */

  const workResult =
    await supabaseClient
      .from("work_shifts")
      .select(
        "id,staff_name,work_date,shift_name,leave_type"
      );


  if (workResult.error) {

    throw workResult.error;

  }


  /* ==================================================
     休暇
  ================================================== */

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


  /* ==================================================
     休業
  ================================================== */

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


  /* ==================================================
     職員
  ================================================== */

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


  /* ==================================================
     勤務形態
  ================================================== */

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


  /* ==================================================
     休暇
  ================================================== */

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


  /* ==================================================
     勤務データ
  ================================================== */

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


  /* ==================================================
     休業
  ================================================== */

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


  /* ==================================================
     明け時間
  ================================================== */

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
   Realtime更新
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


async function reloadFromSupabase() {

  if (!supabaseClient) {

    return;

  }


  if (
    cloudOperationBusy
  ) {

    return;

  }


  if (
    realtimeUpdating
  ) {

    return;

  }


  realtimeUpdating =
    true;


  try {

    await loadAllFromSupabase();

    renderAll();

  } catch (error) {

    console.error(
      "自動更新エラー",
      error
    );

  } finally {

    realtimeUpdating =
      false;

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
   ★ 集計用勤務形態正規化
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
   ★ 合計列用勤務形態一覧
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
   ★ 休暇一覧表示
================================================== */

function renderLeaveLegend() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (!table) {

    return;

  }


  /*
    既に作成されている場合は再利用。
  */

  let legend =
    document.getElementById(
      "leaveLegend"
    );


  /*
    なければ勤務表の直後に自動作成。
  */

  if (!legend) {

    legend =
      document.createElement(
        "div"
      );


    legend.id =
      "leaveLegend";


    legend.style.marginTop =
      "10px";


    legend.style.marginBottom =
      "10px";


    legend.style.padding =
      "10px 12px";


    legend.style.border =
      "1px solid #d1d1d6";


    legend.style.borderRadius =
      "10px";


    legend.style.background =
      "#ffffff";


    legend.style.boxSizing =
      "border-box";


    /*
      tableの直後に配置
    */

    if (
      table.parentElement
    ) {

      table.parentElement.insertBefore(
        legend,
        table.nextSibling
      );

    }

  }


  /*
    休暇が登録されていない場合
  */

  if (
    !Array.isArray(
      appData.leaveTypes
    ) ||
    appData.leaveTypes.length ===
      0
  ) {

    legend.style.display =
      "none";


    legend.innerHTML =
      "";


    return;

  }


  legend.style.display =
    "flex";


  legend.style.flexWrap =
    "wrap";


  legend.style.alignItems =
    "center";


  legend.style.gap =
    "8px 14px";


  let html =
    `
      <div
        style="
          width:100%;
          font-weight:700;
          font-size:14px;
          margin-bottom:2px;
        "
      >
        🏖️ 休暇一覧
      </div>
    `;


  appData.leaveTypes.forEach(
    leave => {

      const color =
        leave.color ||
        "#FFD54F";


      const textColor =
        getTextColorForBackground(
          color
        );


      html += `
        <div
          style="
            display:flex;
            align-items:center;
            gap:6px;
            min-height:28px;
          "
        >

          <span
            style="
              display:inline-flex;
              align-items:center;
              justify-content:center;
              min-width:20px;
              width:20px;
              height:20px;
              border-radius:5px;
              background:${escapeHtml(
                color
              )};
              border:1px solid rgba(0,0,0,.18);
              box-sizing:border-box;
              flex-shrink:0;
            "
            
          ></span>

          <span
            style="
              font-size:13px;
              line-height:1.3;
              color:#222;
              white-space:nowrap;
            "
          >
            ${escapeHtml(
              leave.name
            )}
          </span>

   

        </div>
      `;

    }
  );


  legend.innerHTML =
    html;

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
    currentDate.getMonth() +
    1;


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


  const totalShiftTypes =
    getTotalShiftTypes();


  let html =
    "";


  /* ==================================================
     colgroup
  ================================================== */

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


  totalShiftTypes.forEach(
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


  /* ==================================================
     ヘッダー
  ================================================== */

  html +=
    "<thead><tr>";


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


  /* ==================================================
     合計・累計ヘッダー
  ================================================== */

  totalShiftTypes.forEach(
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
    "</tr><tr>";


  totalShiftTypes.forEach(
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
    "</tr></thead><tbody>";


  /* ==================================================
     職員行
  ================================================== */

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


      /* ==================================================
         日付セル
      ================================================== */

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


        /*
          ★休暇があっても
          勤務形態の文字は変更しない。

          背景色だけ変更。
        */

        const backgroundStyle =
          leaveColor
            ? `background:${escapeHtml(
                leaveColor
              )} !important;`
            : "";


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
              ${backgroundStyle}
            "
          >
            ${escapeHtml(
              display
            )}
          </td>
        `;

      }


      /* ==================================================
         合計・累計
      ================================================== */

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
    days *
      dateColumnWidth +
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


  /*
    ★勤務表の下に休暇一覧を表示
  */

  renderLeaveLegend();

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


            selectedCell =
              cell;


            shiftMenuMode =
              "shift";


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
    .forEach(
      cell => {

        cell.addEventListener(
          "click",
          () => {

            openCalendarConfirm(
              cell.dataset.staff
            );

          }
        );

      }
    );

}


/* ==================================================
   勤務メニュー表示
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


  buttons.innerHTML =
    "";


  /* ==================================================
     勤務形態モード
  ================================================== */

  if (
    shiftMenuMode ===
    "shift"
  ) {

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


        button.textContent =
          shift.name;


        button.className =
          "shift-menu-button";


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
// 勤務削除ボタン
const deleteShiftButton = document.createElement("button");

deleteShiftButton.textContent = "🗑️ 勤務削除";

deleteShiftButton.style.width = "100%";
deleteShiftButton.style.minWidth = "100%";
deleteShiftButton.style.gridColumn = "1 / -1";
deleteShiftButton.style.boxSizing = "border-box";

deleteShiftButton.style.background = "#6f42c1";
deleteShiftButton.style.color = "#ffffff";
deleteShiftButton.style.borderColor = "#59339d";
deleteShiftButton.style.fontWeight = "700";

deleteShiftButton.addEventListener("click", async () => {

  // 勤務形態だけ削除
  await saveWorkShift(
    staffName,
    dateKey,
    ""
  );

  // メニューを閉じる
  menu.style.display = "none";

  // 表示更新
  renderSchedule();
});

// キャンセルボタンの上に追加
buttons.appendChild(deleteShiftButton);

    /* ==================================================
       キャンセル
       ★休暇と同じく横幅いっぱい
       ★赤色
    ================================================== */

    const cancelButton =
      document.createElement(
        "button"
      );


    cancelButton.type =
      "button";


    cancelButton.textContent =
      "キャンセル";


    cancelButton.className =
      "shift-menu-button";


    cancelButton.style.width =
      "100%";


    cancelButton.style.minWidth =
      "100%";


    cancelButton.style.gridColumn =
      "1 / -1";


    cancelButton.style.boxSizing =
      "border-box";


    cancelButton.style.background =
      "#dc3545";


    cancelButton.style.color =
      "#ffffff";


    cancelButton.style.borderColor =
      "#c82333";


    cancelButton.style.fontWeight =
      "700";


    cancelButton.addEventListener(
      "click",
      e => {

        e.stopPropagation();

        hideShiftMenu();

      }
    );


    buttons.appendChild(
      cancelButton
    );


    /* ==================================================
       休暇
       ★必ず一番下
       ★横幅いっぱい
       ★緑色
    ================================================== */

    const leaveButton =
      document.createElement(
        "button"
      );


    leaveButton.type =
      "button";


    leaveButton.textContent =
      "🏖️ 休暇";


    leaveButton.className =
      "shift-menu-button";


    leaveButton.style.width =
      "100%";


    leaveButton.style.minWidth =
      "100%";


    leaveButton.style.gridColumn =
      "1 / -1";


    leaveButton.style.boxSizing =
      "border-box";


    leaveButton.style.background =
      "#28a745";


    leaveButton.style.color =
      "#ffffff";


    leaveButton.style.borderColor =
      "#218838";


    leaveButton.style.fontWeight =
      "700";


    leaveButton.addEventListener(
      "click",
      e => {

        e.stopPropagation();


        shiftMenuMode =
          "leave";


        showShiftMenu(
          cell,
          staffName,
          dateKey
        );

      }
    );


    buttons.appendChild(
      leaveButton
    );


    const title =
      menu.querySelector(
        ".shift-menu-title"
      );


    if (title) {

      title.textContent =
        "勤務を選択";

    }

  }


  /* ==================================================
     休暇モード
  ================================================== */

  else {

    const title =
      menu.querySelector(
        ".shift-menu-title"
      );


    if (title) {

      title.textContent =
        "🏖️ 休暇を選択";

    }


    /* -----------------------------------------------
       休暇なし
    ------------------------------------------------ */

    if (
      appData.leaveTypes.length ===
      0
    ) {

      const empty =
        document.createElement(
          "div"
        );


      empty.textContent =
        "登録された休暇がありません";


      empty.style.padding =
        "12px";


      empty.style.textAlign =
        "center";


      empty.style.color =
        "#666";


      buttons.appendChild(
        empty
      );

    }


    /* -----------------------------------------------
       休暇一覧
    ------------------------------------------------ */

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
            leave.color ||
            "#FFD54F"
          );


        button.style.boxSizing =
          "border-box";


        button.addEventListener(
          "click",
          async e => {

            e.stopPropagation();


            await saveLeave(
              staffName,
              dateKey,
              leave.name
            );


            hideShiftMenu();

          }
        );


        buttons.appendChild(
          button
        );

      }
    );


    /* -----------------------------------------------
       休暇解除
    ------------------------------------------------ */

    const removeLeaveButton =
      document.createElement(
        "button"
      );


    removeLeaveButton.type =
      "button";


    removeLeaveButton.textContent =
      "休暇を解除";


    removeLeaveButton.className =
      "shift-menu-button";


    removeLeaveButton.addEventListener(
      "click",
      async e => {

        e.stopPropagation();


        await saveLeave(
          staffName,
          dateKey,
          ""
        );


        hideShiftMenu();

      }
    );


    buttons.appendChild(
      removeLeaveButton
    );


    /* -----------------------------------------------
       キャンセル
       ★横幅いっぱい
       ★赤色
    ------------------------------------------------ */

    const cancelButton =
      document.createElement(
        "button"
      );


    cancelButton.type =
      "button";


    cancelButton.textContent =
      "キャンセル";


    cancelButton.className =
      "shift-menu-button";


    cancelButton.style.width =
      "100%";


    cancelButton.style.minWidth =
      "100%";


    cancelButton.style.gridColumn =
      "1 / -1";


    cancelButton.style.boxSizing =
      "border-box";


    cancelButton.style.background =
      "#dc3545";


    cancelButton.style.color =
      "#ffffff";


    cancelButton.style.borderColor =
      "#c82333";


    cancelButton.style.fontWeight =
      "700";


    cancelButton.addEventListener(
      "click",
      e => {

        e.stopPropagation();


        hideShiftMenu();

      }
    );


    buttons.appendChild(
      cancelButton
    );

  }


  /* ==================================================
     メニュー位置
  ================================================== */

  menu.style.display =
    "grid";


  const rect =
    cell.getBoundingClientRect();


  const menuWidth =
    Math.min(
      190,
      window.innerWidth - 20
    );


  menu.style.width =
    menuWidth +
    "px";


  let left =
    rect.right + 6;


  if (
    left +
      menuWidth >
    window.innerWidth - 10
  ) {

    left =
      rect.left -
      menuWidth -
      6;

  }


  if (
    left < 10
  ) {

    left = 10;

  }


  let top =
    rect.top;


  const menuHeight =
    menu.offsetHeight ||
    250;


  if (
    top +
      menuHeight >
    window.innerHeight - 10
  ) {

    top =
      window.innerHeight -
      menuHeight -
      10;

  }


  if (
    top < 10
  ) {

    top = 10;

  }


  menu.style.position =
    "fixed";


  menu.style.left =
    left +
    "px";


  menu.style.top =
    top +
    "px";


  menu.style.zIndex =
    "9999";

}


/* ==================================================
   メニューを閉じる
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

  if (!supabaseClient) {

    alert(
      "Supabaseに接続されていません。"
    );

    return;

  }


  const name =
    getStaffName(
      staffName
    );


  cloudOperationBusy =
    true;


  try {

    const existing =
      await supabaseClient
        .from("work_shifts")
        .select(
          "id,leave_type"
        )
        .eq(
          "staff_name",
          name
        )
        .eq(
          "work_date",
          dateKey
        )
        .order(
          "id",
          {
            ascending: true
          }
        )
        .limit(1);


    if (
      existing.error
    ) {

      throw existing.error;

    }


    const existingRow =
      existing.data &&
      existing.data.length
        ? existing.data[0]
        : null;


    if (!shiftName) {

      if (existingRow) {

        const result =
          await supabaseClient
            .from("work_shifts")
            .delete()
            .eq(
              "id",
              existingRow.id
            );


        if (
          result.error
        ) {

          throw result.error;

        }

      }


      setStoredShift(
        name,
        dateKey,
        "",
        ""
      );


      renderSchedule();


      return;

    }


    const leaveType =
      existingRow
        ? existingRow.leave_type ||
          ""
        : "";


    if (existingRow) {

      const result =
        await supabaseClient
          .from("work_shifts")
          .update({

            shift_name:
              shiftName,

            leave_type:
              leaveType

          })
          .eq(
            "id",
            existingRow.id
          );


      if (
        result.error
      ) {

        throw result.error;

      }

    } else {

      const result =
        await supabaseClient
          .from("work_shifts")
          .insert({

            staff_name:
              name,

            work_date:
              dateKey,

            shift_name:
              shiftName,

            leave_type:
              null

          });


      if (
        result.error
      ) {

        throw result.error;

      }

    }


    setStoredShift(
      name,
      dateKey,
      shiftName,
      leaveType
    );


    renderSchedule();


  } catch (error) {

    console.error(
      "勤務保存エラー",
      error
    );


    alert(
      "勤務の保存に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

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

  if (!supabaseClient) {

    alert(
      "Supabaseに接続されていません。"
    );

    return;

  }


  const name =
    getStaffName(
      staffName
    );


  cloudOperationBusy =
    true;


  try {

    const existing =
      await supabaseClient
        .from("work_shifts")
        .select(
          "id,shift_name,leave_type"
        )
        .eq(
          "staff_name",
          name
        )
        .eq(
          "work_date",
          dateKey
        )
        .order(
          "id",
          {
            ascending: true
          }
        )
        .limit(1);


    if (
      existing.error
    ) {

      throw existing.error;

    }


    const row =
      existing.data &&
      existing.data.length
        ? existing.data[0]
        : null;


    /* -----------------------------------------------
       休暇解除
    ------------------------------------------------ */

    if (!leaveName) {

      if (row) {

        const result =
          await supabaseClient
            .from("work_shifts")
            .update({

              leave_type:
                null

            })
            .eq(
              "id",
              row.id
            );


        if (
          result.error
        ) {

          throw result.error;

        }


        setStoredShift(
          name,
          dateKey,
          row.shift_name ||
            "",
          ""
        );

      }


      renderSchedule();


      return;

    }


    /* -----------------------------------------------
       既存勤務がある場合
       勤務形態は変更しない
    ------------------------------------------------ */

    if (row) {

      const result =
        await supabaseClient
          .from("work_shifts")
          .update({

            leave_type:
              leaveName

          })
          .eq(
            "id",
            row.id
          );


      if (
        result.error
      ) {

        throw result.error;

      }


      setStoredShift(
        name,
        dateKey,
        row.shift_name ||
          "",
        leaveName
      );

    } else {

      const result =
        await supabaseClient
          .from("work_shifts")
          .insert({

            staff_name:
              name,

            work_date:
              dateKey,

            shift_name:
              "",

            leave_type:
              leaveName

          });


      if (
        result.error
      ) {

        throw result.error;

      }


      setStoredShift(
        name,
        dateKey,
        "",
        leaveName
      );

    }


    renderSchedule();


  } catch (error) {

    console.error(
      "休暇保存エラー",
      error
    );


    alert(
      "休暇の保存に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   背景色から文字色を決定
================================================== */

function getTextColorForBackground(
  color
) {

  if (!color) {

    return "#000000";

  }


  const hex =
    color.replace(
      "#",
      ""
    );


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
    ) /
    1000;


  return brightness > 155
    ? "#000000"
    : "#ffffff";

}


/* ==================================================
   ★ 月間集計
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


  let total =
    0;


  const targetShift =
    normalizeShiftNameForTotal(
      shiftName
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


    const display =
      getDisplayShift(
        staffName,
        dateKey
      );


    const normalizedDisplay =
      normalizeShiftNameForTotal(
        display
      );


    if (
      normalizedDisplay ===
        targetShift &&
      normalizedDisplay !==
        "明"
    ) {

      total++;

    }

  }


  return total;

}


/* ==================================================
   ★ 年度累計
================================================== */

function calculateFiscalTotal(
  staffName,
  shiftName,
  year,
  month
) {

  let total =
    0;


  const fiscalStartYear =
    month >= 4
      ? year
      : year - 1;


  const targetShift =
    normalizeShiftNameForTotal(
      shiftName
    );


  const startDate =
    new Date(
      fiscalStartYear,
      3,
      1
    );


  const endDate =
    new Date(
      year,
      month - 1,
      getDaysInMonth(
        year,
        month
      )
    );


  const current =
    new Date(
      startDate
    );


  while (
    current <=
    endDate
  ) {

    const dateKey =
      getDateKey(
        current.getFullYear(),
        current.getMonth() + 1,
        current.getDate()
      );


    const display =
      getDisplayShift(
        staffName,
        dateKey
      );


    const normalizedDisplay =
      normalizeShiftNameForTotal(
        display
      );


    if (
      normalizedDisplay ===
        targetShift &&
      normalizedDisplay !==
        "明"
    ) {

      total++;

    }


    current.setDate(
      current.getDate() + 1
    );

  }


  return total;

}


/* ==================================================
   職員追加・編集
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
      "職員名を入力してください"
    );

    return;

  }


  if (
    name === "明"
  ) {

    alert(
      "「明」は登録できません"
    );

    return;

  }


  const duplicate =
    appData.staff.some(
      (staff, index) =>
        getStaffName(staff) ===
          name &&
        index !==
          editingStaffIndex
    );


  if (duplicate) {

    alert(
      "同じ職員名は登録できません"
    );

    return;

  }


  cloudOperationBusy =
    true;


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


      if (
        oldName !== name
      ) {

        const workResult =
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
          workResult.error
        ) {

          throw workResult.error;

        }

      }


      const result =
        await supabaseClient
          .from("staff")
          .update({

            name

          })
          .eq(
            "id",
            oldStaff.id
          );


      if (
        result.error
      ) {

        throw result.error;

      }


      editingStaffIndex =
        -1;

    } else {

      const maxOrder =
        appData.staff.reduce(
          (max, staff) => {

            const value =
              Number(
                staff.sort_order
              );


            return Number.isFinite(
              value
            )

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
          .from("staff")
          .insert({

            name,

            sort_order:
              maxOrder + 1

          });


      if (
        result.error
      ) {

        throw result.error;

      }

    }


    input.value =
      "";


    const button =
      document.getElementById(
        "addStaffButton"
      );


    if (button) {

      button.textContent =
        "追加";

    }


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

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   職員並び順保存
================================================== */

async function saveStaffOrder() {

  try {

    for (
      let i = 0;
      i < appData.staff.length;
      i++
    ) {

      const result =
        await supabaseClient
          .from("staff")
          .update({

            sort_order:
              i

          })
          .eq(
            "id",
            appData.staff[i].id
          );


      if (
        result.error
      ) {

        throw result.error;

      }


      appData.staff[i]
        .sort_order =
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


async function moveStaff(
  index,
  direction
) {

  const newIndex =
    index +
    direction;


  if (
    newIndex < 0 ||
    newIndex >=
      appData.staff.length
  ) {

    return;

  }


  if (
    cloudOperationBusy
  ) {

    return;

  }


  [
    appData.staff[index],
    appData.staff[newIndex]
  ] = [

    appData.staff[newIndex],
    appData.staff[index]

  ];


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


  cloudOperationBusy =
    true;


  try {

    if (
      !await saveStaffOrder()
    ) {

      throw new Error(
        "並び順保存失敗"
      );

    }

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

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   職員一覧
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
        <div class="list-item-main">
          <div class="list-item-title">
            ${escapeHtml(name)}
          </div>
        </div>

        <div class="list-item-buttons">

          <button
            type="button"
            class="list-button move-staff-up-button"
            ${
              index === 0
                ? "disabled"
                : ""
            }
          >
            ↑
          </button>

          <button
            type="button"
            class="list-button move-staff-down-button"
            ${
              index ===
              appData.staff.length - 1
                ? "disabled"
                : ""
            }
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


      item
        .querySelector(
          ".move-staff-up-button"
        )
        ?.addEventListener(
          "click",
          () =>
            moveStaff(
              index,
              -1
            )
        );


      item
        .querySelector(
          ".move-staff-down-button"
        )
        ?.addEventListener(
          "click",
          () =>
            moveStaff(
              index,
              1
            )
        );


      item
        .querySelector(
          ".edit-staff-button"
        )
        ?.addEventListener(
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


      item
        .querySelector(
          ".delete-staff-button"
        )
        ?.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                `${name}を削除しますか？`
              )
            ) {

              return;

            }


            cloudOperationBusy =
              true;


            try {

              const workResult =
                await supabaseClient
                  .from("work_shifts")
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
                  .from("staff")
                  .delete()
                  .eq(
                    "id",
                    staff.id
                  );


              if (
                result.error
              ) {

                throw result.error;

              }


              editingStaffIndex =
                -1;


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

              cloudOperationBusy =
                false;

            }

          }
        );


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
    startInput?.value ||
    "";


  const end =
    endInput?.value ||
    "";


  const breakTime =
    breakInput?.value ||
    "";


  if (!name) {

    alert(
      "勤務形態名を入力してください"
    );

    return;

  }


  if (
    name === "明"
  ) {

    alert(
      "「明」は登録できません"
    );

    return;

  }


  const duplicate =
    appData.shiftTypes.some(
      (shift, index) =>
        shift.name === name &&
        index !==
          editingShiftIndex
    );


  if (duplicate) {

    alert(
      "同じ勤務形態名を登録できません"
    );

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (
      editingShiftIndex >= 0
    ) {

      const oldShift =
        appData.shiftTypes[
          editingShiftIndex
        ];


      if (
        oldShift.name !== name
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
              oldShift.name
            );


        if (
          workResult.error
        ) {

          throw workResult.error;

        }

      }


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
              breakTime || null

          })
          .eq(
            "id",
            oldShift.id
          );


      if (
        result.error
      ) {

        throw result.error;

      }


      editingShiftIndex =
        -1;

    } else {

      const result =
        await supabaseClient
          .from("shift_types")
          .insert({

            name,

            start_time:
              start || null,

            end_time:
              end || null,

            break_time:
              breakTime || null

          });


      if (
        result.error
      ) {

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


    const button =
      document.getElementById(
        "addShiftButton"
      );


    if (button) {

      button.textContent =
        "勤務形態を追加";

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

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   勤務形態一覧
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
        <div class="list-item-main">

          <div class="list-item-title">
            ${escapeHtml(
              shift.name
            )}
          </div>

          <div class="list-item-sub">
            ${escapeHtml(
              timeText
            )}
          </div>

        </div>

        <div class="list-item-buttons">

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


      item
        .querySelector(
          ".edit-shift-button"
        )
        ?.addEventListener(
          "click",
          () => {

            document.getElementById(
              "shiftNameInput"
            ).value =
              shift.name;


            document.getElementById(
              "shiftStartInput"
            ).value =
              shift.start ||
              "";


            document.getElementById(
              "shiftEndInput"
            ).value =
              shift.end ||
              "";


            document.getElementById(
              "shiftBreakInput"
            ).value =
              shift.break ||
              "";


            editingShiftIndex =
              index;


            document.getElementById(
              "addShiftButton"
            ).textContent =
              "勤務形態を更新";

          }
        );


      item
        .querySelector(
          ".delete-shift-button"
        )
        ?.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                `${shift.name}を削除しますか？`
              )
            ) {

              return;

            }


            cloudOperationBusy =
              true;


            try {

              const workResult =
                await supabaseClient
                  .from("work_shifts")
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


              editingShiftIndex =
                -1;


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

              cloudOperationBusy =
                false;

            }

          }
        );


      list.appendChild(
        item
      );

    }
  );

}


/* ==================================================
   休暇追加・編集
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
      "休暇名を入力してください"
    );

    return;

  }


  const duplicate =
    appData.leaveTypes.some(
      leave =>
        leave.name === name &&
        String(leave.id) !==
          String(editingLeaveId)
    );


  if (duplicate) {

    alert(
      "同じ休暇名は登録できません"
    );

    return;

  }


  if (!supabaseClient) {

    alert(
      "Supabaseに接続されていません。"
    );

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (
      editingLeaveId
    ) {

      const oldLeave =
        appData.leaveTypes.find(
          leave =>
            String(leave.id) ===
            String(editingLeaveId)
        );


      const result =
        await supabaseClient
          .from("leave_types")
          .update({

            name,

            color

          })
          .eq(
            "id",
            editingLeaveId
          );


      if (
        result.error
      ) {

        throw result.error;

      }


      if (
        oldLeave &&
        oldLeave.name !== name
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
              oldLeave.name
            );


        if (
          workResult.error
        ) {

          throw workResult.error;

        }

      }


      editingLeaveId =
        null;

    } else {

      const result =
        await supabaseClient
          .from("leave_types")
          .insert({

            name,

            color

          });


      if (
        result.error
      ) {

        throw result.error;

      }

    }


    nameInput.value =
      "";


    if (colorInput) {

      colorInput.value =
        "#FFD54F";

    }


    const button =
      document.getElementById(
        "addLeaveButton"
      );


    if (button) {

      button.textContent =
        "休暇を追加";

    }


    await loadAllFromSupabase();


    renderLeaveList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇保存エラー",
      error
    );


    alert(
      "休暇の保存に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   休暇一覧
================================================== */

function renderLeaveList() {

  const list =
    document.getElementById(
      "leaveList"
    );


  if (!list) {

    return;

  }


  list.innerHTML =
    "";


  appData.leaveTypes.forEach(
    leave => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "list-item";


      item.innerHTML = `
        <div
          class="list-item-main"
          style="
            display:flex;
            align-items:center;
            gap:10px;
          "
        >

          <span
            style="
              display:inline-block;
              width:28px;
              height:28px;
              border-radius:7px;
              background:${escapeHtml(
                leave.color
              )};
              border:1px solid rgba(0,0,0,.15);
              flex-shrink:0;
            "
          ></span>

          <div>

            <div class="list-item-title">
              ${escapeHtml(
                leave.name
              )}
            </div>

            <div class="list-item-sub">
              ${escapeHtml(
                leave.color
              )}
            </div>

          </div>

        </div>

        <div class="list-item-buttons">

          <button
            type="button"
            class="list-button edit-leave-button"
          >
            編集
          </button>

          <button
            type="button"
            class="list-button delete delete-leave-button"
          >
            削除
          </button>

        </div>
      `;


      item
        .querySelector(
          ".edit-leave-button"
        )
        ?.addEventListener(
          "click",
          () => {

            const nameInput =
              document.getElementById(
                "leaveNameInput"
              );


            const colorInput =
              document.getElementById(
                "leaveColorInput"
              );


            if (nameInput) {

              nameInput.value =
                leave.name;

              nameInput.focus();

            }


            if (colorInput) {

              colorInput.value =
                leave.color ||
                "#FFD54F";

            }


            editingLeaveId =
              leave.id;


            const button =
              document.getElementById(
                "addLeaveButton"
              );


            if (button) {

              button.textContent =
                "休暇を更新";

            }

          }
        );


      item
        .querySelector(
          ".delete-leave-button"
        )
        ?.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                `${leave.name}を削除しますか？\nこの休暇を使用している勤務表からも休暇情報が解除されます。`
              )
            ) {

              return;

            }


            cloudOperationBusy =
              true;


            try {

              const workResult =
                await supabaseClient
                  .from("work_shifts")
                  .update({

                    leave_type:
                      null

                  })
                  .eq(
                    "leave_type",
                    leave.name
                  );


              if (
                workResult.error
              ) {

                throw workResult.error;

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


              if (
                String(
                  editingLeaveId
                ) ===
                String(
                  leave.id
                )
              ) {

                editingLeaveId =
                  null;

              }


              const button =
                document.getElementById(
                  "addLeaveButton"
                );


              if (button) {

                button.textContent =
                  "休暇を追加";

              }


              await loadAllFromSupabase();


              renderLeaveList();

              renderSchedule();


            } catch (error) {

              console.error(
                "休暇削除エラー",
                error
              );


              alert(
                "休暇の削除に失敗しました。"
              );

            } finally {

              cloudOperationBusy =
                false;

            }

          }
        );


      list.appendChild(
        item
      );

    }
  );

}


/* ==================================================
   休業設定
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
    endInput?.value ||
    start;


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


  if (
    start > end
  ) {

    alert(
      "終了日は開始日以降にしてください"
    );

    return;

  }


  const overlap =
    appData.companyHolidays.some(
      h =>
        (
          !editingHolidayId ||
          String(h.id) !==
            String(editingHolidayId)
        ) &&
        start <= h.end &&
        end >= h.start
    );


  if (overlap) {

    alert(
      "既に登録されている休業期間と重複しています"
    );

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (
      editingHolidayId
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


      editingHolidayId =
        null;

    } else {

      const result =
        await supabaseClient
          .from("company_holidays")
          .insert({

            name,

            start_date:
              start,

            end_date:
              end

          });


      if (
        result.error
      ) {

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


    document.getElementById(
      "addCompanyHolidayButton"
    ).textContent =
      "休業を登録";


    await loadAllFromSupabase();


    renderHolidayList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休業設定保存エラー",
      error
    );


    alert(
      "休業設定の保存に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   休業一覧
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
        <div class="list-item-main">

          <div class="list-item-title">
            ${escapeHtml(
              holiday.name
            )}
          </div>

          <div class="list-item-sub">
            ${escapeHtml(
              dateText
            )}
          </div>

        </div>

        <div class="list-item-buttons">

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


      item
        .querySelector(
          ".edit-holiday-button"
        )
        ?.addEventListener(
          "click",
          () => {

            document.getElementById(
              "companyHolidayName"
            ).value =
              holiday.name;


            document.getElementById(
              "companyHolidayStart"
            ).value =
              holiday.start;


            document.getElementById(
              "companyHolidayEnd"
            ).value =
              holiday.start ===
              holiday.end
                ? ""
                : holiday.end;


            editingHolidayId =
              holiday.id;


            document.getElementById(
              "addCompanyHolidayButton"
            ).textContent =
              "休業を更新";

          }
        );


      item
        .querySelector(
          ".delete-holiday-button"
        )
        ?.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                `${holiday.name}を削除しますか？`
              )
            ) {

              return;

            }


            cloudOperationBusy =
              true;


            try {

              const result =
                await supabaseClient
                  .from(
                    "company_holidays"
                  )
                  .delete()
                  .eq(
                    "id",
                    holiday.id
                  );


              if (
                result.error
              ) {

                throw result.error;

              }


              await loadAllFromSupabase();


              renderHolidayList();

              renderSchedule();


            } catch (error) {

              console.error(
                "休業削除エラー",
                error
              );


              alert(
                "休業設定の削除に失敗しました。"
              );

            } finally {

              cloudOperationBusy =
                false;

            }

          }
        );


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


  if (
    !start ||
    !end ||
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


  appData.akeTime = {

    start:
      start.value,

    end:
      end.value

  };


  saveLocalData();


  if (
    supabaseClient
  ) {

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


    if (
      result.error
    ) {

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
   カレンダー
================================================== */

function openCalendarConfirm(
  staffName
) {

  const name =
    getStaffName(
      staffName
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


  const title =
    document.getElementById(
      "calendarConfirmTitle"
    );


  const text =
    document.getElementById(
      "calendarConfirmText"
    );


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


  /*
    ★webcalを維持
  */

  const webcalUrl =
    "webcal://" +
    SUPABASE_URL.replace(
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
   月削除
================================================== */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth() +
    1;


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


    if (
      result.error
    ) {

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

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   年度削除
================================================== */

async function deleteFiscalYear() {

  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth() +
    1;


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


    if (
      result.error
    ) {

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

    cloudOperationBusy =
      false;

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


  } catch (error) {

    console.warn(
      "祝日データ取得失敗",
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
    currentDate.getMonth() +
    1;


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


    const leaveName =
      getStoredLeave(
        staffName,
        dateKey
      );


    let title =
      shiftName;


    if (leaveName) {

      title +=
        ` (${leaveName})`;

    }


    if (
      shiftName ===
      "休み"
    ) {

      ics +=
        createAllDayEvent(
          uid,
          dateKey,
          title,
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
          title,
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
          title,
          staffName
        );

    } else {

      ics +=
        createTimedEvent(
          uid,
          dateKey,
          title,
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
   ICS 全日イベント
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
   ICS 時間指定イベント
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
      endDate.getDate() +
      1
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
   UTC変換
================================================== */

function formatUTC(
  date
) {

  return (
    date.getUTCFullYear() +

    String(
      date.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    ) +

    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    ) +

    "T" +

    String(
      date.getUTCHours()
    ).padStart(
      2,
      "0"
    ) +

    String(
      date.getUTCMinutes()
    ).padStart(
      2,
      "0"
    ) +

    String(
      date.getUTCSeconds()
    ).padStart(
      2,
      "0"
    ) +

    "Z"
  );

}


/* ==================================================
   現在時刻UTC
================================================== */

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
    date.getDate() +
    1
  );


  return getDateKey(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );

}


/* ==================================================
   他職員勤務
================================================== */

function getOtherStaffDescription(
  currentStaff,
  dateKey
) {

  const currentName =
    getStaffName(
      currentStaff
    );


  const lines =
    [];


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

        const leave =
          getStoredLeave(
            staffName,
            dateKey
          );


        lines.push(
          `${staffName}: ${shift}${leave ? ` (${leave})` : ""}`
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
