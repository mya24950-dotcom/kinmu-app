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


/* ==================================================
   現在年月
================================================== */

let currentDate = new Date();

currentDate.setDate(1);


/* ==================================================
   状態
================================================== */

let selectedCell = null;

let selectedStaffName = "";

let selectedDateKey = "";

let editingStaffIndex = -1;

let editingShiftIndex = -1;

let editingHolidayId = null;

let editingLeaveTypeIndex = -1;

let publicHolidays = {};

let realtimeChannel = null;

let realtimeReloadTimer = null;

let autoSyncTimer = null;

let realtimeUpdating = false;

let cloudOperationBusy = false;

let leaveMenuOpen = false;


/* ==================================================
   起動
================================================== */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  console.log(
    "★ 勤務表アプリ起動"
  );


  try {

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

      alert(
        "Supabaseからデータを取得できませんでした。\n" +
        "現在の画面を表示します。"
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
      "Supabaseへの接続に失敗しました。\n" +
      "アプリ自体は起動します。"
    );

  }

}


/* ==================================================
   ローカル読み込み
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
   ローカル保存
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
   Supabase全データ取得
================================================== */

async function loadAllFromSupabase() {

  if (!supabaseClient) {

    throw new Error(
      "Supabaseクライアントがありません"
    );

  }


  /* 職員 */

  const staffResult =
    await supabaseClient
      .from("staff")
      .select(
        "id,name,created_at,sort_order,calendar_token"
      );


  if (staffResult.error) {

    throw staffResult.error;

  }


  /* 勤務形態 */

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


  /* 勤務 */

  const workResult =
    await supabaseClient
      .from("work_shifts")
      .select(
        "id,staff_name,work_date,shift_name,leave_type"
      );


  if (workResult.error) {

    throw workResult.error;

  }


  /* 休業 */

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


  /* 休暇種類 */

  const leaveTypeResult =
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

    console.error(
      "leave_types取得エラー:",
      leaveTypeResult.error
    );

  }


  /* -----------------------------------------------
     職員
  ------------------------------------------------ */

  const rawStaff =
    (staffResult.data || [])
      .map(
        (row, index) => ({

          id: row.id,

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


      if (aHas && bHas) {

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


      if (aHas && !bHas) {

        return -1;

      }


      if (!aHas && bHas) {

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


  appData.staff =
    rawStaff.map(
      row => ({

        id: row.id,

        name: row.name,

        sort_order:
          row.sort_order,

        calendar_token:
          row.calendar_token || ""

      })
    );


  /* -----------------------------------------------
     勤務形態
  ------------------------------------------------ */

  appData.shiftTypes =
    (shiftResult.data || [])
      .map(
        row => ({

          id: row.id,

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


  /* -----------------------------------------------
     勤務・休暇
  ------------------------------------------------ */

  appData.shifts = {};

  appData.leaves = {};


  appData.staff.forEach(
    staff => {

      appData.shifts[
        staff.name
      ] = {};

      appData.leaves[
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


        if (
          !appData.leaves[
            row.staff_name
          ]
        ) {

          appData.leaves[
            row.staff_name
          ] = {};

        }


        if (row.leave_type) {

          appData.leaves[
            row.staff_name
          ][
            row.work_date
          ] =
            row.leave_type;

          appData.shifts[
            row.staff_name
          ][
            row.work_date
          ] = "";

        } else {

          appData.shifts[
            row.staff_name
          ][
            row.work_date
          ] =
            row.shift_name || "";

        }

      }
    );


  /* -----------------------------------------------
     休業
  ------------------------------------------------ */

  if (!holidayResult.error) {

    appData.companyHolidays =
      (holidayResult.data || [])
        .map(
          row => ({

            id: row.id,

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


  /* -----------------------------------------------
     休暇種類
  ------------------------------------------------ */

  if (!leaveTypeResult.error) {

    appData.leaveTypes =
      (leaveTypeResult.data || [])
        .map(
          row => ({

            id: row.id,

            name:
              String(
                row.name || ""
              ),

            color:
              row.color ||
              "#d9f2df",

            created_at:
              row.created_at || ""

          })
        )
        .filter(
          row =>
            row.name &&
            row.name !== "明"
        );

  } else {

    appData.leaveTypes = [];

  }


  /* -----------------------------------------------
     明け時間
  ------------------------------------------------ */

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

      start: akeStart,

      end: akeEnd

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


      /* 職員 */

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


      /* 勤務 */

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


      /* 勤務形態 */

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


      /* 休業 */

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


      /* 休暇種類 */

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
              "★ Supabase Realtime接続成功"
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
   自動同期
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

}


/* ==================================================
   アプリ復帰
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


  /* ナビ */

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


  /* 前月 */

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


  /* 次月 */

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


  /* 職員追加 */

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


  /* 勤務形態追加 */

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


  /* 休業追加 */

  const addHolidayButton =
    document.getElementById(
      "addCompanyHolidayButton"
    );


  if (addHolidayButton) {

    addHolidayButton.addEventListener(
      "click",
      addCompanyHoliday
    );

  }


  /* 明け時間 */

  const saveAkeButton =
    document.getElementById(
      "saveAkeTimeButton"
    );


  if (saveAkeButton) {

    saveAkeButton.addEventListener(
      "click",
      saveAkeTime
    );

  }


  /* 休暇種類 */

  const addLeaveTypeButton =
    document.getElementById(
      "addLeaveTypeButton"
    );


  if (addLeaveTypeButton) {

    addLeaveTypeButton.addEventListener(
      "click",
      addLeaveType
    );

  }


  /* カレンダーキャンセル */

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


  /* カレンダー */

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


  /* 月消去 */

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


  /* 年度消去 */

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


  /* 画面外クリック */

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
        !shiftMenu.contains(
          event.target
        ) &&
        !event.target.closest(
          ".shift-cell"
        )
      ) {

        hideShiftMenu();

      }


      if (
        leaveMenu &&
        !leaveMenu.contains(
          event.target
        ) &&
        !event.target.closest(
          ".shift-cell"
        )
      ) {

        hideLeaveMenu();

      }

    }
  );

}

/* ==================================================
   全体表示
================================================== */

function renderAll() {

  renderSchedule();

  renderStaffList();

  renderShiftList();

  renderCompanyHolidayList();

  renderLeaveTypeList();

  renderAkeInputs();

}


/* ==================================================
   ページ切り替え
================================================== */

function showPage(page) {

  const pages = {

    schedule:
      document.getElementById(
        "schedulePage"
      ),

    staff:
      document.getElementById(
        "staffPage"
      ),

    shift:
      document.getElementById(
        "shiftPage"
      ),

    holiday:
      document.getElementById(
        "holidayPage"
      ),

    leaveType:
      document.getElementById(
        "leaveTypePage"
      )

  };


  Object.keys(pages)
    .forEach(
      key => {

        if (!pages[key]) {

          return;

        }


        pages[key].style.display =
          key === page
            ? ""
            : "none";

      }
    );


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


  if (page === "schedule") {

    renderSchedule();

  }


  if (page === "staff") {

    renderStaffList();

  }


  if (page === "shift") {

    renderShiftList();

    renderAkeInputs();

  }


  if (page === "holiday") {

    renderCompanyHolidayList();

  }


  if (page === "leaveType") {

    renderLeaveTypeList();

  }

}


/* ==================================================
   明け時間入力表示
================================================== */

function renderAkeInputs() {

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
   日付キー
================================================== */

function dateToKey(date) {

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


/* ==================================================
   月の日数
================================================== */

function getDaysInMonth() {

  return new Date(

    currentDate.getFullYear(),

    currentDate.getMonth() + 1,

    0

  ).getDate();

}


/* ==================================================
   曜日
================================================== */

function getJapaneseWeekday(
  date
) {

  const weeks = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
  ];


  return weeks[
    date.getDay()
  ];

}


/* ==================================================
   休業日取得
================================================== */

function getCompanyHoliday(
  dateKey
) {

  return appData.companyHolidays.find(
    holiday =>
      dateKey >= holiday.start &&
      dateKey <= holiday.end
  ) || null;

}


/* ==================================================
   国民の祝日
================================================== */

function isPublicHoliday(
  dateKey
) {

  return Boolean(
    publicHolidays[
      dateKey
    ]
  );

}


/* ==================================================
   休暇種類取得
================================================== */

function getLeaveType(
  name
) {

  return appData.leaveTypes.find(
    item =>
      item.name === name
  ) || null;

}


/* ==================================================
   表示勤務
================================================== */

function getDisplayShift(
  staffName,
  dateKey
) {

  const leave =
    appData.leaves[
      staffName
    ] &&
    appData.leaves[
      staffName
    ][
      dateKey
    ];


  if (leave) {

    return leave;

  }


  const ownShift =
    appData.shifts[
      staffName
    ] &&
    appData.shifts[
      staffName
    ][
      dateKey
    ];


  if (ownShift) {

    return ownShift;

  }


  /* 前日の宿・夜なら明 */

  const date =
    new Date(
      dateKey + "T00:00:00"
    );


  date.setDate(
    date.getDate() - 1
  );


  const previousKey =
    dateToKey(date);


  const previousShift =
    appData.shifts[
      staffName
    ] &&
    appData.shifts[
      staffName
    ][
      previousKey
    ];


  if (
    previousShift &&
    (
      previousShift.includes("宿") ||
      previousShift.includes("夜")
    )
  ) {

    return "明";

  }


  return "";

}


/* ==================================================
   勤務セルの休暇判定
================================================== */

function getLeaveForCell(
  staffName,
  dateKey
) {

  if (
    !appData.leaves[
      staffName
    ]
  ) {

    return null;

  }


  const leaveName =
    appData.leaves[
      staffName
    ][
      dateKey
    ];


  if (!leaveName) {

    return null;

  }


  return getLeaveType(
    leaveName
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

  const title =
    document.getElementById(
      "currentMonth"
    );


  if (!table) {

    return;

  }


  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  if (title) {

    title.textContent =
      `${year}年${month + 1}月`;

  }


  table.innerHTML = "";


  /* -----------------------------------------------
     職員なし
  ------------------------------------------------ */

  if (
    appData.staff.length === 0
  ) {

    const tbody =
      document.createElement(
        "tbody"
      );


    const row =
      document.createElement(
        "tr"
      );


    const cell =
      document.createElement(
        "td"
      );


    cell.colSpan = 32;

    cell.textContent =
      "職員を登録してください。";

    cell.style.padding =
      "30px";


    row.appendChild(cell);

    tbody.appendChild(row);

    table.appendChild(tbody);

    return;

  }


  /* -----------------------------------------------
     THEAD
  ------------------------------------------------ */

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


  const days =
    getDaysInMonth();


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


    const th =
      document.createElement(
        "th"
      );


    th.className =
      "date-header";


    const week =
      date.getDay();


    if (week === 6) {

      th.classList.add(
        "saturday"
      );

    }


    if (
      week === 0 ||
      isPublicHoliday(
        dateToKey(date)
      )
    ) {

      th.classList.add(
        "holiday"
      );

    }


    if (
      getCompanyHoliday(
        dateToKey(date)
      )
    ) {

      th.classList.add(
        "company-holiday"
      );

    }


    th.innerHTML =
      `<div class="day-number">
        ${day}
      </div>
      <div class="day-week">
        ${getJapaneseWeekday(date)}
      </div>`;


    headerRow.appendChild(th);

  }


  /* 合計 */

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


  /* -----------------------------------------------
     TBODY
  ------------------------------------------------ */

  const tbody =
    document.createElement(
      "tbody"
    );


  appData.staff.forEach(
    staff => {

      const row =
        document.createElement(
          "tr"
        );


      row.className =
        "staff-row";


      /* 職員名 */

      const staffCell =
        document.createElement(
          "th"
        );


      staffCell.className =
        "staff-cell";


      staffCell.classList.add(
        "staff-name-cell"
      );


      staffCell.textContent =
        staff.name;


      staffCell.title =
        "カレンダー登録";


      staffCell.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          openCalendarModal(
            staff
          );

        }
      );


      row.appendChild(
        staffCell
      );


      /* 日付 */

      let total =
        0;


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
          dateToKey(date);


        const cell =
          document.createElement(
            "td"
          );


        cell.className =
          "shift-cell";


        cell.dataset.staff =
          staff.name;


        cell.dataset.date =
          dateKey;


        const week =
          date.getDay();


        if (week === 6) {

          cell.classList.add(
            "saturday"
          );

        }


        if (
          week === 0 ||
          isPublicHoliday(
            dateKey
          )
        ) {

          cell.classList.add(
            "holiday"
          );

        }


        if (
          getCompanyHoliday(
            dateKey
          )
        ) {

          cell.classList.add(
            "company-holiday"
          );

        }


        const leave =
          getLeaveForCell(
            staff.name,
            dateKey
          );


        if (leave) {

          cell.textContent =
            leave.name;

          cell.style.backgroundColor =
            leave.color ||
            "#d9f2df";

          cell.style.color =
            "#1d1d1f";

          cell.style.fontWeight =
            "700";

        } else {

          const display =
            getDisplayShift(
              staff.name,
              dateKey
            );


          cell.textContent =
            display;


          if (
            display &&
            display !== "明"
          ) {

            total++;

          }

        }


        cell.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            if (
              leaveMenuOpen
            ) {

              return;

            }


            showShiftMenu(
              cell,
              staff.name,
              dateKey
            );

          }
        );


        row.appendChild(
          cell
        );

      }


      /* 合計 */

      const totalCell =
        document.createElement(
          "td"
        );


      totalCell.className =
        "total-cell";

      totalCell.textContent =
        total;


      row.appendChild(
        totalCell
      );


      tbody.appendChild(
        row
      );

    }
  );


  table.appendChild(
    tbody
  );

}


/* ==================================================
   公休日読み込み
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
      "祝日データを取得できませんでした",
      error
    );

  }

}

/* ==================================================
   勤務メニュー表示
================================================== */

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


  selectedCell =
    cell;

  selectedStaffName =
    staffName;

  selectedDateKey =
    dateKey;


  hideLeaveMenu();


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
        "shift-menu-button";


      button.textContent =
        shift.name;


      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

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


  /* 削除 */

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

      deleteWorkShift(
        staffName,
        dateKey
      );

    }
  );


  buttons.appendChild(
    deleteButton
  );


  /* 休暇 */

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


/* ==================================================
   勤務メニュー位置
================================================== */

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


  const menuWidth =
    menu.offsetWidth;


  const menuHeight =
    menu.offsetHeight;


  let left =
    rect.left;


  let top =
    rect.bottom + 6;


  const margin =
    8;


  if (
    left + menuWidth >
    window.innerWidth - margin
  ) {

    left =
      window.innerWidth -
      menuWidth -
      margin;

  }


  if (
    left < margin
  ) {

    left =
      margin;

  }


  if (
    top + menuHeight >
    window.innerHeight - margin
  ) {

    top =
      rect.top -
      menuHeight -
      6;

  }


  if (
    top < margin
  ) {

    top =
      margin;

  }


  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

  menu.style.visibility =
    "visible";

}


/* ==================================================
   勤務メニュー非表示
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

}


/* ==================================================
   休暇メニュー
================================================== */

function showLeaveMenu(
  cell,
  staffName,
  dateKey
) {

  hideShiftMenu();


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


  selectedCell =
    cell;

  selectedStaffName =
    staffName;

  selectedDateKey =
    dateKey;


  leaveMenuOpen =
    true;


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
        "leave-type-menu-button";


      button.textContent =
        leaveType.name;


      button.style.backgroundColor =
        leaveType.color ||
        "#d9f2df";


      button.addEventListener(
        "click",
        event => {

          event.stopPropagation();

          saveLeave(
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


  /* 休暇解除 */

  const removeButton =
    document.createElement(
      "button"
    );


  removeButton.type =
    "button";


  removeButton.className =
    "shift-menu-button shift-delete";


  removeButton.textContent =
    "休暇を解除";


  removeButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      removeLeave(
        staffName,
        dateKey
      );

    }
  );


  buttons.appendChild(
    removeButton
  );


  /* キャンセル */

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


/* ==================================================
   休暇メニュー非表示
================================================== */

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


/* ==================================================
   勤務登録
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


    hideShiftMenu();

    hideLeaveMenu();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務保存エラー:",
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
   休暇登録
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
              leaveType
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
      leaveType;


    appData.shifts[
      staffName
    ][
      dateKey
    ] =
      "";


    hideLeaveMenu();

    hideShiftMenu();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇保存エラー:",
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
   休暇解除
================================================== */

async function removeLeave(
  staffName,
  dateKey
) {

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


    hideLeaveMenu();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇解除エラー:",
      error
    );


    alert(
      "休暇の解除に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   勤務削除
================================================== */

async function deleteWorkShift(
  staffName,
  dateKey
) {

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


    hideShiftMenu();

    hideLeaveMenu();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務削除エラー:",
      error
    );


    alert(
      "勤務の削除に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}

/* ==================================================
   休暇種類一覧
================================================== */

function renderLeaveTypeList() {

  const list =
    document.getElementById(
      "leaveTypeList"
    );

  const count =
    document.getElementById(
      "leaveTypeCount"
    );


  if (!list) {

    return;

  }


  list.innerHTML =
    "";


  if (count) {

    count.textContent =
      `${appData.leaveTypes.length}種類`;

  }


  if (
    appData.leaveTypes.length === 0
  ) {

    list.innerHTML =
      `<div class="empty-message">
        休暇種類が登録されていません
      </div>`;

    return;

  }


  appData.leaveTypes.forEach(
    (leaveType, index) => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "leave-type-item";


      const left =
        document.createElement(
          "div"
        );


      left.className =
        "leave-type-left";


      const color =
        document.createElement(
          "div"
        );


      color.className =
        "leave-type-color";


      color.style.backgroundColor =
        leaveType.color ||
        "#d9f2df";


      const name =
        document.createElement(
          "div"
        );


      name.className =
        "leave-type-name";


      name.textContent =
        leaveType.name;


      left.appendChild(
        color
      );

      left.appendChild(
        name
      );


      const actions =
        document.createElement(
          "div"
        );


      actions.className =
        "leave-type-actions";


      const edit =
        document.createElement(
          "button"
        );


      edit.type =
        "button";


      edit.className =
        "leave-type-edit";


      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () => {

          editLeaveType(
            leaveType,
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
        "leave-type-delete";


      del.textContent =
        "削除";


      del.addEventListener(
        "click",
        () => {

          deleteLeaveType(
            leaveType,
            index
          );

        }
      );


      actions.appendChild(
        edit
      );

      actions.appendChild(
        del
      );


      item.appendChild(
        left
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


/* ==================================================
   休暇種類追加
================================================== */

async function addLeaveType() {

  const nameInput =
    document.getElementById(
      "leaveTypeNameInput"
    );

  const colorInput =
    document.getElementById(
      "leaveTypeColorInput"
    );


  if (!nameInput) {

    return;

  }


  const name =
    nameInput.value.trim();


  const color =
    colorInput
      ? colorInput.value
      : "#d9f2df";


  if (!name) {

    alert(
      "休暇種類名を入力してください。"
    );

    return;

  }


  if (name === "明") {

    alert(
      "「明」は休暇種類として登録できません。"
    );

    return;

  }


  const exists =
    appData.leaveTypes.some(
      item =>
        item.name === name
    );


  if (exists) {

    alert(
      "同じ休暇種類がすでに登録されています。"
    );

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("leave_types")
        .insert({
          name: name,
          color: color
        })
        .select(
          "id,name,color,created_at"
        )
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.leaveTypes.push({

      id:
        result.data.id,

      name:
        result.data.name,

      color:
        result.data.color ||
        "#d9f2df",

      created_at:
        result.data.created_at ||
        ""

    });


    nameInput.value =
      "";


    if (colorInput) {

      colorInput.value =
        "#d9f2df";

    }


    renderLeaveTypeList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇種類登録エラー:",
      error
    );


    alert(
      "休暇種類の登録に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   休暇種類編集
================================================== */

async function editLeaveType(
  leaveType,
  index
) {

  const newName =
    prompt(
      "休暇種類名",
      leaveType.name
    );


  if (newName === null) {

    return;

  }


  const name =
    newName.trim();


  if (!name) {

    alert(
      "休暇種類名を入力してください。"
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
    appData.leaveTypes.some(
      (item, i) =>
        i !== index &&
        item.name === name
    );


  if (duplicate) {

    alert(
      "同じ休暇種類が存在します。"
    );

    return;

  }


  const color =
    prompt(
      "色（例：#d9f2df）",
      leaveType.color ||
      "#d9f2df"
    );


  if (color === null) {

    return;

  }


  const newColor =
    color.trim() ||
    "#d9f2df";


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("leave_types")
        .update({
          name: name,
          color: newColor
        })
        .eq(
          "id",
          leaveType.id
        )
        .select(
          "id,name,color,created_at"
        )
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.leaveTypes[
      index
    ] = {

      id:
        result.data.id,

      name:
        result.data.name,

      color:
        result.data.color ||
        "#d9f2df",

      created_at:
        result.data.created_at ||
        ""

    };


    renderLeaveTypeList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休暇種類編集エラー:",
      error
    );


    alert(
      "休暇種類の変更に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   休暇種類削除
================================================== */

async function deleteLeaveType(
  leaveType,
  index
) {

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


    appData.leaveTypes.splice(
      index,
      1
    );


    renderLeaveTypeList();

    renderSchedule();

    hideLeaveMenu();


  } catch (error) {

    console.error(
      "休暇種類削除エラー:",
      error
    );


    alert(
      "休暇種類の削除に失敗しました。"
    );

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


      const main =
        document.createElement(
          "div"
        );


      main.className =
        "list-item-main";


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "list-item-title";


      title.textContent =
        staff.name;


      main.appendChild(
        title
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


      edit.className =
        "list-button";


      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () => {

          editStaff(
            staff,
            index
          );

        }
      );


      const del =
        document.createElement(
          "button"
        );


      del.className =
        "list-button delete";


      del.textContent =
        "削除";


      del.addEventListener(
        "click",
        () => {

          deleteStaff(
            staff,
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
        main
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

/* ==================================================
   職員追加
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


  if (name === "明") {

    alert(
      "「明」は職員名に使用できません。"
    );

    return;

  }


  if (
    appData.staff.some(
      staff =>
        staff.name === name
    )
  ) {

    alert(
      "同じ職員名が登録されています。"
    );

    return;

  }


  const sortOrder =
    appData.staff.length;


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("staff")
        .insert({
          name: name,
          sort_order:
            sortOrder
        })
        .select(
          "id,name,sort_order,calendar_token"
        )
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.staff.push({

      id:
        result.data.id,

      name:
        result.data.name,

      sort_order:
        result.data.sort_order,

      calendar_token:
        result.data.calendar_token ||
        ""

    });


    appData.shifts[
      name
    ] = {};

    appData.leaves[
      name
    ] = {};


    input.value =
      "";


    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "職員追加エラー:",
      error
    );


    alert(
      "職員の追加に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   職員編集
================================================== */

async function editStaff(
  staff,
  index
) {

  const newName =
    prompt(
      "職員名",
      staff.name
    );


  if (newName === null) {

    return;

  }


  const name =
    newName.trim();


  if (!name) {

    return;

  }


  if (name === "明") {

    alert(
      "「明」は使用できません。"
    );

    return;

  }


  if (
    appData.staff.some(
      (item, i) =>
        i !== index &&
        item.name === name
    )
  ) {

    alert(
      "同じ職員名が存在します。"
    );

    return;

  }


  cloudOperationBusy =
    true;


  try {

    const result =
      await supabaseClient
        .from("staff")
        .update({
          name: name
        })
        .eq(
          "id",
          staff.id
        );


    if (result.error) {

      throw result.error;

    }


    if (
      appData.shifts[
        staff.name
      ]
    ) {

      appData.shifts[
        name
      ] =
        appData.shifts[
          staff.name
        ];

      delete appData.shifts[
        staff.name
      ];

    }


    if (
      appData.leaves[
        staff.name
      ]
    ) {

      appData.leaves[
        name
      ] =
        appData.leaves[
          staff.name
        ];

      delete appData.leaves[
        staff.name
      ];

    }


    appData.staff[
      index
    ].name =
      name;


    /* DB上の勤務データも変更 */

    const workResult =
      await supabaseClient
        .from("work_shifts")
        .update({
          staff_name: name
        })
        .eq(
          "staff_name",
          staff.name
        );


    if (workResult.error) {

      console.warn(
        "勤務データ職員名変更:",
        workResult.error
      );

    }


    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "職員編集エラー:",
      error
    );


    alert(
      "職員名の変更に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   職員削除
================================================== */

async function deleteStaff(
  staff,
  index
) {

  const ok =
    confirm(
      `「${staff.name}」を削除しますか？\n\n勤務データも削除されます。`
    );


  if (!ok) {

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
          staff.name
        );


    if (workResult.error) {

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


    if (result.error) {

      throw result.error;

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


    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "職員削除エラー:",
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


  if (
    appData.shiftTypes.length === 0
  ) {

    list.innerHTML =
      `<div class="empty-message">
        勤務形態が登録されていません
      </div>`;

    return;

  }


  appData.shiftTypes.forEach(
    (shift, index) => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "list-item";


      const main =
        document.createElement(
          "div"
        );


      main.className =
        "list-item-main";


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "list-item-title";


      title.textContent =
        shift.name;


      const sub =
        document.createElement(
          "div"
        );


      sub.className =
        "list-item-sub";


      sub.textContent =
        `${shift.start || "--:--"} ～ ${
          shift.end || "--:--"
        }` +
        `　休憩 ${shift.break || 0}分`;


      main.appendChild(
        title
      );

      main.appendChild(
        sub
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


      edit.className =
        "list-button";


      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () => {

          editShift(
            shift,
            index
          );

        }
      );


      const del =
        document.createElement(
          "button"
        );


      del.className =
        "list-button delete";


      del.textContent =
        "削除";


      del.addEventListener(
        "click",
        () => {

          deleteShift(
            shift,
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
        main
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


/* ==================================================
   勤務形態追加
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


  const name =
    nameInput.value.trim();


  const start =
    startInput.value;


  const end =
    endInput.value;


  const breakTime =
    breakInput.value || "0";


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


  if (
    appData.shiftTypes.some(
      shift =>
        shift.name === name
    )
  ) {

    alert(
      "同じ勤務形態が登録されています。"
    );

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
            start || null,

          end_time:
            end || null,

          break_time:
            Number(
              breakTime
            )

        })
        .select(
          "id,name,created_at,start_time,end_time,break_time"
        )
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.shiftTypes.push({

      id:
        result.data.id,

      name:
        result.data.name,

      start:
        String(
          result.data.start_time ||
          ""
        ),

      end:
        String(
          result.data.end_time ||
          ""
        ),

      break:
        String(
          result.data.break_time ||
          "0"
        )

    });


    nameInput.value =
      "";

    startInput.value =
      "";

    endInput.value =
      "";

    breakInput.value =
      "";


    renderShiftList();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務形態追加エラー:",
      error
    );


    alert(
      "勤務形態の追加に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}

/* ==================================================
   勤務形態編集
================================================== */

async function editShift(
  shift,
  index
) {

  const name =
    prompt(
      "勤務形態名",
      shift.name
    );


  if (name === null) {

    return;

  }


  const newName =
    name.trim();


  if (!newName) {

    return;

  }


  const start =
    prompt(
      "開始時間（例：08:30）",
      shift.start
    );


  if (start === null) {

    return;

  }


  const end =
    prompt(
      "終了時間（例：17:30）",
      shift.end
    );


  if (end === null) {

    return;

  }


  const breakTime =
    prompt(
      "休憩時間（分）",
      shift.break || "0"
    );


  if (breakTime === null) {

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
            newName,

          start_time:
            start || null,

          end_time:
            end || null,

          break_time:
            Number(
              breakTime || 0
            )

        })
        .eq(
          "id",
          shift.id
        )
        .select(
          "id,name,created_at,start_time,end_time,break_time"
        )
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.shiftTypes[
      index
    ] = {

      id:
        result.data.id,

      name:
        result.data.name,

      start:
        String(
          result.data.start_time ||
          ""
        ),

      end:
        String(
          result.data.end_time ||
          ""
        ),

      break:
        String(
          result.data.break_time ||
          "0"
        )

    };


    renderShiftList();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務形態編集エラー:",
      error
    );


    alert(
      "勤務形態の変更に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   勤務形態削除
================================================== */

async function deleteShift(
  shift,
  index
) {

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


    renderShiftList();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務形態削除エラー:",
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


/* ==================================================
   休業一覧
================================================== */

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


  if (
    appData.companyHolidays.length === 0
  ) {

    list.innerHTML =
      `<div class="empty-message">
        休業設定が登録されていません
      </div>`;

    return;

  }


  appData.companyHolidays.forEach(
    holiday => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "list-item";


      const main =
        document.createElement(
          "div"
        );


      main.className =
        "list-item-main";


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "list-item-title";


      title.textContent =
        holiday.name;


      const sub =
        document.createElement(
          "div"
        );


      sub.className =
        "list-item-sub";


      sub.textContent =
        holiday.start ===
        holiday.end

          ? holiday.start

          : `${holiday.start} ～ ${holiday.end}`;


      main.appendChild(
        title
      );

      main.appendChild(
        sub
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


      edit.className =
        "list-button";


      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () => {

          editCompanyHoliday(
            holiday
          );

        }
      );


      const del =
        document.createElement(
          "button"
        );


      del.className =
        "list-button delete";


      del.textContent =
        "削除";


      del.addEventListener(
        "click",
        () => {

          deleteCompanyHoliday(
            holiday
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
        main
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


/* ==================================================
   休業追加
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
        .select(
          "id,name,start_date,end_date"
        )
        .single();


    if (result.error) {

      throw result.error;

    }


    appData.companyHolidays.push({

      id:
        result.data.id,

      name:
        result.data.name,

      start:
        result.data.start_date,

      end:
        result.data.end_date

    });


    appData.companyHolidays.sort(
      (a, b) =>
        a.start.localeCompare(
          b.start
        )
    );


    nameInput.value =
      "";

    startInput.value =
      "";

    endInput.value =
      "";


    saveLocalData();

    renderCompanyHolidayList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休業登録エラー:",
      error
    );


    alert(
      "休業の登録に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   休業編集
================================================== */

async function editCompanyHoliday(
  holiday
) {

  const name =
    prompt(
      "休業名",
      holiday.name
    );


  if (name === null) {

    return;

  }


  const start =
    prompt(
      "開始日（YYYY-MM-DD）",
      holiday.start
    );


  if (start === null) {

    return;

  }


  const end =
    prompt(
      "終了日（YYYY-MM-DD）",
      holiday.end
    );


  if (end === null) {

    return;

  }


  if (end < start) {

    alert(
      "終了日は開始日以降にしてください。"
    );

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
            name.trim(),

          start_date:
            start,

          end_date:
            end

        })
        .eq(
          "id",
          holiday.id
        );


    if (result.error) {

      throw result.error;

    }


    holiday.name =
      name.trim();

    holiday.start =
      start;

    holiday.end =
      end;


    saveLocalData();

    renderCompanyHolidayList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休業編集エラー:",
      error
    );


    alert(
      "休業の変更に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   休業削除
================================================== */

async function deleteCompanyHoliday(
  holiday
) {

  const ok =
    confirm(
      `「${holiday.name}」を削除しますか？`
    );


  if (!ok) {

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


    appData.companyHolidays =
      appData.companyHolidays.filter(
        item =>
          item.id !==
          holiday.id
      );


    saveLocalData();

    renderCompanyHolidayList();

    renderSchedule();


  } catch (error) {

    console.error(
      "休業削除エラー:",
      error
    );


    alert(
      "休業の削除に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   明け時間保存
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
      "明け時間保存エラー:",
      error
    );


    alert(
      "明け時間の保存に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   アプリ設定保存
================================================== */

async function saveAppSetting(
  name,
  value
) {

  const findResult =
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


  if (findResult.error) {

    throw findResult.error;

  }


  if (findResult.data) {

    const updateResult =
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


    if (updateResult.error) {

      throw updateResult.error;

    }

  } else {

    const insertResult =
      await supabaseClient
        .from("app_settings")
        .insert({

          setting_name:
            name,

          setting_value:
            value

        });


    if (insertResult.error) {

      throw insertResult.error;

    }

  }

}


/* ==================================================
   月消去
================================================== */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  const start =
    `${year}-${String(
      month + 1
    ).padStart(2, "0")}-01`;


  const lastDay =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const end =
    `${year}-${String(
      month + 1
    ).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")`;


  const ok =
    confirm(
      `${year}年${month + 1}月の勤務をすべて削除しますか？`
    );


  if (!ok) {

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


    Object.keys(
      appData.shifts
    ).forEach(
      staffName => {

        Object.keys(
          appData.shifts[
            staffName
          ]
        ).forEach(
          dateKey => {

            if (
              dateKey >= start &&
              dateKey <= end
            ) {

              delete appData.shifts[
                staffName
              ][
                dateKey
              ];

            }

          }
        );

      }
    );


    Object.keys(
      appData.leaves
    ).forEach(
      staffName => {

        Object.keys(
          appData.leaves[
            staffName
          ]
        ).forEach(
          dateKey => {

            if (
              dateKey >= start &&
              dateKey <= end
            ) {

              delete appData.leaves[
                staffName
              ][
                dateKey
              ];

            }

          }
        );

      }
    );


    renderSchedule();


    alert(
      "今月の勤務を削除しました。"
    );


  } catch (error) {

    console.error(
      "月消去エラー:",
      error
    );


    alert(
      "月の勤務削除に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}

/* ==================================================
   年度範囲
================================================== */

function getFiscalYearRange() {

  const now =
    new Date();


  const fiscalYear =
    now.getMonth() >= 3

      ? now.getFullYear()

      : now.getFullYear() - 1;


  return {

    year:
      fiscalYear,

    start:
      `${fiscalYear}-04-01`,

    end:
      `${fiscalYear + 1}-03-31`

  };

}


/* ==================================================
   年度消去
================================================== */

async function deleteFiscalYear() {

  const range =
    getFiscalYearRange();


  const ok =
    confirm(
      `${range.year}年度（${range.start} ～ ${range.end}）の勤務をすべて削除しますか？`
    );


  if (!ok) {

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
          range.start
        )
        .lte(
          "work_date",
          range.end
        );


    if (result.error) {

      throw result.error;

    }


    Object.keys(
      appData.shifts
    ).forEach(
      staffName => {

        Object.keys(
          appData.shifts[
            staffName
          ]
        ).forEach(
          dateKey => {

            if (
              dateKey >= range.start &&
              dateKey <= range.end
            ) {

              delete appData.shifts[
                staffName
              ][
                dateKey
              ];

            }

          }
        );

      }
    );


    Object.keys(
      appData.leaves
    ).forEach(
      staffName => {

        Object.keys(
          appData.leaves[
            staffName
          ]
        ).forEach(
          dateKey => {

            if (
              dateKey >= range.start &&
              dateKey <= range.end
            ) {

              delete appData.leaves[
                staffName
              ][
                dateKey
              ];

            }

          }
        );

      }
    );


    renderSchedule();


    alert(
      `${range.year}年度の勤務を削除しました。`
    );


  } catch (error) {

    console.error(
      "年度消去エラー:",
      error
    );


    alert(
      "年度の勤務削除に失敗しました。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   カレンダーモーダル
================================================== */

function openCalendarModal(
  staff
) {

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


  selectedStaffName =
    staff.name;


  if (title) {

    title.textContent =
      `${staff.name}の勤務表`;

  }


  if (text) {

    text.textContent =
      `${currentDate.getFullYear()}年${
        currentDate.getMonth() + 1
      }月の勤務をカレンダー用ファイルにします。`;

  }


  modal.style.display =
    "flex";

}


/* ==================================================
   カレンダーモーダル閉じる
================================================== */

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
   ICS用文字列
================================================== */

function escapeICS(
  value
) {

  return String(
    value || ""
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


/* ==================================================
   カレンダー登録
================================================== */

function subscribeStaffCalendar() {

  if (!selectedStaffName) {

    closeCalendarModal();

    return;

  }


  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  const days =
    getDaysInMonth();


  const events = [];


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
      dateToKey(date);


    const leave =
      getLeaveForCell(
        selectedStaffName,
        dateKey
      );


    const display =
      getDisplayShift(
        selectedStaffName,
        dateKey
      );


    if (!leave && !display) {

      continue;

    }


    let title =
      "";


    if (leave) {

      title =
        `休暇：${leave.name}`;

    } else {

      title =
        `勤務：${display}`;

    }


    const nextDate =
      new Date(date);

    nextDate.setDate(
      nextDate.getDate() + 1
    );


    const nextKey =
      dateToKey(nextDate)
        .replace(
          /-/g,
          ""
        );


    const dateValue =
      dateKey.replace(
        /-/g,
        ""
      );


    events.push(

      "BEGIN:VEVENT\n" +

      `DTSTART;VALUE=DATE:${dateValue}\n` +

      `DTEND;VALUE=DATE:${nextKey}\n` +

      `SUMMARY:${escapeICS(title)}\n` +

      `UID:${dateValue}-${encodeURIComponent(
        selectedStaffName
      )}@workschedule\n` +

      "END:VEVENT"

    );

  }


  const ics =
    [
      "BEGIN:VCALENDAR",

      "VERSION:2.0",

      "PRODID:-//勤務表//JP",

      "CALSCALE:GREGORIAN",

      "METHOD:PUBLISH",

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


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;


  link.download =
    `勤務表_${selectedStaffName}_${year}年${
      month + 1
    }月.ics`;


  document.body.appendChild(
    link
  );


  link.click();


  link.remove();


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


/* ==================================================
   休暇メニューの状態リセット
================================================== */

window.addEventListener(
  "resize",
  () => {

    hideShiftMenu();

    hideLeaveMenu();

  }
);


/* ==================================================
   Escape
================================================== */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Escape"
    ) {

      hideShiftMenu();

      hideLeaveMenu();

      closeCalendarModal();

    }

  }
);

