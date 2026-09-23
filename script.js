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

  akeTime: {
    start: "05:30",
    end: "11:15"
  }

};


let currentDate =
  new Date();

currentDate.setDate(1);


let editingStaffIndex = -1;

let editingShiftIndex = -1;

let editingHolidayId = null;

let editingLeaveTypeId = null;

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

      console.log(
        "★ Supabaseデータ取得成功"
      );

    } catch (error) {

      console.error(
        "★ Supabaseデータ取得失敗",
        error
      );

      /*
       * Supabaseに問題があっても
       * ローカルデータでアプリを表示
       */

      ensureLocalDataStructure();

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

    ensureLocalDataStructure();

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


    if (
      Array.isArray(
        parsed.staff
      )
    ) {

      appData.staff =
        parsed.staff;

    }


    if (
      Array.isArray(
        parsed.shiftTypes
      )
    ) {

      appData.shiftTypes =
        parsed.shiftTypes;

    }


    if (
      Array.isArray(
        parsed.leaveTypes
      )
    ) {

      appData.leaveTypes =
        parsed.leaveTypes;

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


    appData.companyHolidays =
      Array.isArray(
        parsed.companyHolidays
      )
        ? parsed.companyHolidays
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
   データ構造確認
================================================== */

function ensureLocalDataStructure() {

  if (
    !Array.isArray(
      appData.staff
    )
  ) {

    appData.staff = [];

  }


  if (
    !Array.isArray(
      appData.shiftTypes
    )
  ) {

    appData.shiftTypes = [];

  }


  if (
    !Array.isArray(
      appData.leaveTypes
    )
  ) {

    appData.leaveTypes = [];

  }


  if (
    !Array.isArray(
      appData.companyHolidays
    )
  ) {

    appData.companyHolidays = [];

  }


  if (
    !appData.shifts ||
    typeof appData.shifts !==
      "object"
  ) {

    appData.shifts = {};

  }


  if (
    !appData.leaves ||
    typeof appData.leaves !==
      "object"
  ) {

    appData.leaves = {};

  }


  if (
    !appData.akeTime ||
    typeof appData.akeTime !==
      "object"
  ) {

    appData.akeTime = {

      start: "05:30",

      end: "11:15"

    };

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


/* ==================================================
   Supabaseから全データ取得
================================================== */

async function loadAllFromSupabase() {

  if (!supabaseClient) {

    throw new Error(
      "Supabaseクライアントがありません"
    );

  }


  ensureLocalDataStructure();


  /* ==================================================
     職員
  ================================================== */

  let staffResult =
    await supabaseClient
      .from("staff")
      .select(
        "id,name,created_at,sort_order,calendar_token"
      );


  /*
   * カラム構成が少し違う場合でも
   * 職員名だけは取得できるようにする
   */

  if (staffResult.error) {

    console.warn(
      "staff詳細取得失敗。簡易取得を試します。",
      staffResult.error
    );


    staffResult =
      await supabaseClient
        .from("staff")
        .select(
          "id,name"
        );

  }


  if (staffResult.error) {

    console.error(
      "staff取得エラー:",
      staffResult.error
    );

    /*
     * ローカルデータを残す
     */

  } else {

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
              row.sort_order !==
                null &&
              row.sort_order !==
                undefined
                ? Number(
                    row.sort_order
                  )
                : null,

            calendar_token:
              row.calendar_token ||
              "",

            created_at:
              row.created_at ||
              "",

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
          bHas &&
          a.sort_order !==
            b.sort_order
        ) {

          return (
            a.sort_order -
            b.sort_order
          );

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


          if (result !== 0) {

            return result;

          }

        }


        return (
          a.originalIndex -
          b.originalIndex
        );

      }
    );


    /*
     * Supabaseにデータがある場合のみ更新
     */

    if (
      rawStaff.length > 0 ||
      appData.staff.length === 0
    ) {

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

    }

  }


  /* ==================================================
     勤務形態
  ================================================== */

  let shiftResult =
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


  /*
   * 詳細カラムがない場合
   * id,nameだけ取得
   */

  if (shiftResult.error) {

    console.warn(
      "shift_types詳細取得失敗。簡易取得を試します。",
      shiftResult.error
    );


    shiftResult =
      await supabaseClient
        .from("shift_types")
        .select(
          "id,name"
        );

  }


  if (shiftResult.error) {

    console.error(
      "shift_types取得エラー:",
      shiftResult.error
    );

  } else {

    const remoteShiftTypes =
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
      remoteShiftTypes.length > 0 ||
      appData.shiftTypes.length === 0
    ) {

      appData.shiftTypes =
        remoteShiftTypes;

    }

  }


  /* ==================================================
     休暇種類
  ================================================== */

  let leaveTypeResult =
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


  if (leaveTypeResult.error) {

    console.warn(
      "leave_types取得エラー:",
      leaveTypeResult.error
    );


    /*
     * nameだけ取得
     */

    leaveTypeResult =
      await supabaseClient
        .from("leave_types")
        .select(
          "id,name"
        );

  }


  if (!leaveTypeResult.error) {

    const remoteLeaveTypes =
      (leaveTypeResult.data || [])
        .map(
          (row, index) => ({

            id:
              row.id,

            name:
              String(
                row.name || ""
              ),

            color:
              safeColor(
                row.color ||
                getDefaultLeaveColor(
                  index
                )
              )

          })
        )
        .filter(
          row =>
            row.name
        );


    if (
      remoteLeaveTypes.length > 0 ||
      appData.leaveTypes.length === 0
    ) {

      appData.leaveTypes =
        remoteLeaveTypes;

    }

  }


  /*
   * leave_typesがまだ存在しない
   * または空の場合
   *
   * 既存仕様の4種類を
   * 画面では使用できるようにする
   */

  if (
    !Array.isArray(
      appData.leaveTypes
    ) ||
    appData.leaveTypes.length === 0
  ) {

    appData.leaveTypes = [

      {
        id: null,
        name: "年休",
        color: "#d9f2df"
      },

      {
        id: null,
        name: "午前休",
        color: "#fff1b8"
      },

      {
        id: null,
        name: "午後休",
        color: "#cfe8ff"
      },

      {
        id: null,
        name: "時間休",
        color: "#eadcff"
      }

    ];

  }


  /* ==================================================
     勤務・休暇
  ================================================== */

  const workResult =
    await supabaseClient
      .from("work_shifts")
      .select(
        "id,staff_name,work_date,shift_name,leave_type"
      );


  if (workResult.error) {

    console.error(
      "work_shifts取得エラー:",
      workResult.error
    );

  } else {

    appData.shifts = {};

    appData.leaves = {};


    appData.staff.forEach(
      staff => {

        const name =
          getStaffName(
            staff
          );


        appData.shifts[name] =
          {};

        appData.leaves[name] =
          {};

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


          if (
            !appData.leaves[
              row.staff_name
            ]
          ) {

            appData.leaves[
              row.staff_name
            ] = {};

          }


          /*
           * 勤務と休暇を別々に保存
           *
           * ここが重要
           */

          if (
            row.shift_name &&
            String(
              row.shift_name
            ).trim()
          ) {

            appData.shifts[
              row.staff_name
            ][
              row.work_date
            ] =
              String(
                row.shift_name
              );

          }


          if (
            row.leave_type &&
            String(
              row.leave_type
            ).trim()
          ) {

            appData.leaves[
              row.staff_name
            ][
              row.work_date
            ] =
              String(
                row.leave_type
              );

          }

        }
      );

  }


  /* ==================================================
     休業設定
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


  if (!akeResult.error) {

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


  ensureLocalDataStructure();

  saveLocalData();

}


/* ==================================================
   Realtime
================================================== */

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

        () => {

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

        () => {

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

        () => {

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

        () => {

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

        () => {

          scheduleRealtimeReload();

        }

      )


      .subscribe(
        status => {

          console.log(
            "Supabase Realtime:",
            status
          );

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

        if (
          !supabaseClient ||
          cloudOperationBusy ||
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
        !shiftMenu.contains(
          e.target
        ) &&
        !e.target.closest(
          ".schedule-cell"
        )
      ) {

        hideShiftMenu();

      }


      if (
        leaveMenu &&
        !leaveMenu.contains(
          e.target
        ) &&
        !e.target.closest(
          ".schedule-cell"
        )
      ) {

        hideLeaveMenu();

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

  hideLeaveMenu();


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

  ensureLocalDataStructure();

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
   勤務保存データ
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
    appData.shifts[name][
      dateKey
    ] || ""
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

    appData.shifts[name][
      dateKey
    ] =
      shiftName;

  } else {

    delete appData.shifts[name][
      dateKey
    ];

  }

}


/* ==================================================
   休暇取得
================================================== */

function getStoredLeave(
  staffName,
  dateKey
) {

  const name =
    getStaffName(
      staffName
    );


  if (
    !appData.leaves[name]
  ) {

    return "";

  }


  return (
    appData.leaves[name][
      dateKey
    ] || ""
  );

}


function setStoredLeave(
  staffName,
  dateKey,
  leaveName
) {

  const name =
    getStaffName(
      staffName
    );


  if (
    !appData.leaves[name]
  ) {

    appData.leaves[name] = {};

  }


  if (leaveName) {

    appData.leaves[name][
      dateKey
    ] =
      leaveName;

  } else {

    delete appData.leaves[name][
      dateKey
    ];

  }

}


/* ==================================================
   休暇種類検索
================================================== */

function findLeaveType(
  leaveName
) {

  return (
    appData.leaveTypes || []
  ).find(
    item =>
      item &&
      String(item.name) ===
        String(leaveName)
  );

}


/* ==================================================
   休暇色
================================================== */

function getDefaultLeaveColor(
  index
) {

  const colors = [

    "#d9f2df",

    "#fff1b8",

    "#cfe8ff",

    "#eadcff",

    "#ffd9e2",

    "#dff5f2"

  ];


  return (
    colors[
      index %
      colors.length
    ] ||
    "#d9f2df"
  );

}


function safeColor(
  color
) {

  if (
    typeof color !==
      "string" ||
    !color.trim()
  ) {

    return "#d9f2df";

  }


  return color;

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
   勤務＋休暇表示
   ★ 休暇は文字を変更しない
================================================== */

function getCellDisplay(
  staffName,
  dateKey
) {

  const shift =
    getDisplayShift(
      staffName,
      dateKey
    );


  const leaveName =
    getStoredLeave(
      staffName,
      dateKey
    );


  let leaveColor =
    "";


  if (leaveName) {

    const leaveType =
      findLeaveType(
        leaveName
      );


    leaveColor =
      leaveType
        ? safeColor(
            leaveType.color
          )
        : "#d9f2df";

  }


  return {

    text:
      shift,

    leaveName,

    hasLeave:
      !!leaveName,

    leaveColor

  };

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


  ensureLocalDataStructure();


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
          getCellDisplay(
            staffName,
            dateKey
          );


        let cellStyle = `

          width:${dateColumnWidth}px;
          min-width:${dateColumnWidth}px;
          max-width:${dateColumnWidth}px;
          box-sizing:border-box;

        `;


        if (
          display.hasLeave
        ) {

          cellStyle += `

            background-color:${safeColor(
              display.leaveColor
            )};

          `;

        }


        const title =
          display.hasLeave

            ? `${display.leaveName}${
                display.text
                  ? " / " +
                    display.text
                  : ""
              }`

            : display.text;


        html += `

          <td
            class="${cls}"
            data-staff="${escapeHtml(
              staffName
            )}"
            data-date="${dateKey}"
            title="${escapeHtml(
              title
            )}"
            style="${cellStyle}"
          >

            ${escapeHtml(
              display.text
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
    .forEach(
      cell => {

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

      }
    );


  table
    .querySelectorAll(
      ".staff-name-cell"
    )
    .forEach(
      cell => {

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

      }
    );


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


            const leaveMenu =
              document.getElementById(
                "leaveMenu"
              );


            if (
              leaveMenu &&
              leaveMenu.style.display !==
                "none" &&
              leaveMenu.style.display !==
                ""
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
    .forEach(
      cell => {

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

      }
    );

}


/* ==================================================
   2列メニュー設定
================================================== */

function setupTwoColumnMenu(
  buttons
) {

  buttons.style.display =
    "grid";

  buttons.style.gridTemplateColumns =
    "repeat(2, minmax(0, 1fr))";

  buttons.style.gap =
    "8px";

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


  const buttons =
    document.getElementById(
      "shiftMenuButtons"
    );


  if (!buttons) {

    return;

  }


  buttons.innerHTML =
    "";


  setupTwoColumnMenu(
    buttons
  );


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


  const deleteButton =
    document.createElement(
      "button"
    );


  deleteButton.type =
    "button";

  deleteButton.textContent =
    "削除";

  deleteButton.className =
    "shift-menu-button shift-delete";


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


  const leaveButton =
    document.createElement(
      "button"
    );


  leaveButton.type =
    "button";

  leaveButton.textContent =
    "休暇";

  leaveButton.className =
    "shift-menu-button shift-leave";


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


  menu.style.display =
    "grid";


  positionPopupMenu(
    menu,
    cell
  );

}


/* ==================================================
   休暇メニュー
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


  buttons.innerHTML =
    "";


  setupTwoColumnMenu(
    buttons
  );


  const leaveTypes =
    appData.leaveTypes || [];


  leaveTypes.forEach(
    leaveType => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";

      button.textContent =
        leaveType.name;

      button.className =
        "shift-menu-button";


      button.style.backgroundColor =
        safeColor(
          leaveType.color
        );


      button.style.color =
        "#1d1d1f";


      button.addEventListener(
        "click",
        async e => {

          e.stopPropagation();


          await saveLeave(

            staffName,

            dateKey,

            leaveType.name

          );


          hideLeaveMenu();

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

  deleteButton.textContent =
    "休暇を解除";

  deleteButton.className =
    "shift-menu-button shift-delete";


  deleteButton.addEventListener(
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
    deleteButton
  );


  const cancelButton =
    document.createElement(
      "button"
    );


  cancelButton.type =
    "button";

  cancelButton.textContent =
    "キャンセル";

  cancelButton.className =
    "shift-menu-button shift-cancel";


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


  menu.style.display =
    "grid";


  positionPopupMenu(
    menu,
    cell
  );

}


/* ==================================================
   ポップアップ位置
================================================== */

function positionPopupMenu(
  menu,
  cell
) {

  const rect =
    cell.getBoundingClientRect();


  const menuWidth =
    Math.min(
      220,
      window.innerWidth - 20
    );


  menu.style.width =
    menuWidth +
    "px";


  menu.style.position =
    "fixed";


  menu.style.zIndex =
    "9999";


  /*
   * 一度表示して高さを取得
   */

  menu.style.visibility =
    "hidden";


  menu.style.display =
    "grid";


  const menuHeight =
    menu.offsetHeight ||
    180;


  let left =
    rect.right + 6;


  if (
    left + menuWidth >
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


  if (
    top + menuHeight >
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

}


function hideLeaveMenu() {

  const menu =
    document.getElementById(
      "leaveMenu"
    );


  if (menu) {

    menu.style.display =
      "none";

  }

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

    /*
     * 対象行を取得
     */

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


    if (existing.error) {

      throw existing.error;

    }


    const existingRow =
      existing.data &&
      existing.data.length > 0
        ? existing.data[0]
        : null;


    /*
     * 勤務削除
     *
     * 休暇が残っている場合は
     * 行自体を削除しない
     */

    if (!shiftName) {

      if (existingRow) {

        if (
          existingRow.leave_type
        ) {

          const result =
            await supabaseClient

              .from(
                "work_shifts"
              )

              .update({

                shift_name:
                  ""

              })

              .eq(
                "id",
                existingRow.id
              );


          if (result.error) {

            throw result.error;

          }

        } else {

          const result =
            await supabaseClient

              .from(
                "work_shifts"
              )

              .delete()

              .eq(
                "id",
                existingRow.id
              );


          if (result.error) {

            throw result.error;

          }

        }

      }


      setStoredShift(
        name,
        dateKey,
        ""
      );


      renderSchedule();


      return;

    }


    /*
     * 勤務登録・変更
     *
     * leave_typeはそのまま保持
     */

    if (existingRow) {

      const result =
        await supabaseClient

          .from(
            "work_shifts"
          )

          .update({

            shift_name:
              shiftName

          })

          .eq(
            "id",
            existingRow.id
          );


      if (result.error) {

        throw result.error;

      }

    } else {

      const result =
        await supabaseClient

          .from(
            "work_shifts"
          )

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


      if (result.error) {

        throw result.error;

      }

    }


    setStoredShift(
      name,
      dateKey,
      shiftName
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
   ★ 勤務形態を絶対に消さない
================================================== */

async function saveLeave(
  staffName,
  dateKey,
  leaveType
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

    const result =
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


    if (result.error) {

      throw result.error;

    }


    const existingRow =
      result.data &&
      result.data.length > 0
        ? result.data[0]
        : null;


    /*
     * 休暇解除
     */

    if (!leaveType) {

      if (existingRow) {

        if (
          existingRow.shift_name
        ) {

          const saveResult =
            await supabaseClient

              .from(
                "work_shifts"
              )

              .update({

                leave_type:
                  null

              })

              .eq(
                "id",
                existingRow.id
              );


          if (
            saveResult.error
          ) {

            throw saveResult.error;

          }

        } else {

          const saveResult =
            await supabaseClient

              .from(
                "work_shifts"
              )

              .delete()

              .eq(
                "id",
                existingRow.id
              );


          if (
            saveResult.error
          ) {

            throw saveResult.error;

          }

        }

      }


      setStoredLeave(
        name,
        dateKey,
        ""
      );


      renderSchedule();


      return;

    }


    /*
     * 休暇登録
     *
     * 既存勤務があれば
     * shift_nameを絶対に変更しない
     */

    if (existingRow) {

      const saveResult =
        await supabaseClient

          .from(
            "work_shifts"
          )

          .update({

            leave_type:
              leaveType

          })

          .eq(
            "id",
            existingRow.id
          );


      if (
        saveResult.error
      ) {

        throw saveResult.error;

      }

    } else {

      const saveResult =
        await supabaseClient

          .from(
            "work_shifts"
          )

          .insert({

            staff_name:
              name,

            work_date:
              dateKey,

            shift_name:
              "",

            leave_type:
              leaveType

          });


      if (
        saveResult.error
      ) {

        throw saveResult.error;

      }

    }


    setStoredLeave(
      name,
      dateKey,
      leaveType
    );


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
      display ===
        shiftName &&
      display !==
        "明"
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


  if (
    month < 4
  ) {

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


    if (
      y === year
    ) {

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
          display ===
            shiftName &&
          display !==
            "明"
        ) {

          total++;

        }

      }

    }

  }


  if (
    month < 4
  ) {

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
          display ===
            shiftName &&
          display !==
            "明"
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
      (staff, index) => {

        return (

          getStaffName(
            staff
          ) ===
            name &&

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


      const id =
        oldStaff.id;


      if (
        oldName !==
          name
      ) {

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


        if (
          workResult.error
        ) {

          throw workResult.error;

        }

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


      if (
        staffResult.error
      ) {

        throw staffResult.error;

      }


      editingStaffIndex =
        -
