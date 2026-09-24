/* =========================================================
   勤務表アプリ 完全版JS
   ========================================================= */

/* =========================================================
   Supabase
========================================================= */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

let supabaseClient = null;


/* =========================================================
   Local Storage
========================================================= */

const STORAGE_KEY =
  "workScheduleAppData";


/* =========================================================
   アプリデータ
========================================================= */

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


/* =========================================================
   状態
========================================================= */

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

let shiftMenuMode =
  "shift";


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

  loadLocalData();

  bindEvents();

  injectScheduleStyles();

  try {

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

    }

  } catch (error) {

    console.error(
      "Supabase初期化エラー",
      error
    );

  }

  if (supabaseClient) {

    try {

      await loadAllFromSupabase();

    } catch (error) {

      console.error(
        "Supabase読み込みエラー",
        error
      );

    }

  }

  renderAll();

  loadPublicHolidays();

  setupRealtime();

  startAutoSync();

  setupVisibilitySync();

  updateScheduleStickyVariables();

}


/* =========================================================
   Local Storage読み込み
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

    const data =
      JSON.parse(saved);

    if (
      Array.isArray(
        data.companyHolidays
      )
    ) {

      appData.companyHolidays =
        data.companyHolidays;

    }

    if (
      Array.isArray(
        data.leaveTypes
      )
    ) {

      appData.leaveTypes =
        data.leaveTypes;

    }

    if (
      data.akeTime
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

    console.warn(
      "LocalStorage読み込みエラー",
      error
    );

  }

}


/* =========================================================
   Local Storage保存
========================================================= */

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

    console.warn(
      "LocalStorage保存エラー",
      error
    );

  }

}


/* =========================================================
   Supabase 全データ読み込み
========================================================= */

async function loadAllFromSupabase() {

  if (!supabaseClient) {

    return;

  }


  /* -------------------------------------------------------
     職員
  ------------------------------------------------------- */

  const staffResult =
    await supabaseClient
      .from("staff")
      .select(
        "id,name,created_at,sort_order,calendar_token"
      );

  if (
    staffResult.error
  ) {

    throw staffResult.error;

  }

  const staffData =
    (staffResult.data || [])
      .map(
        (staff, index) => ({

          ...staff,

          originalIndex:
            index

        })
      )
      .filter(
        staff =>
          staff.name &&
          staff.name !== "明"
      )
      .sort(
        (a, b) => {

          const ao =
            Number(a.sort_order);

          const bo =
            Number(b.sort_order);

          const av =
            Number.isFinite(ao)
              ? ao
              : 999999;

          const bv =
            Number.isFinite(bo)
              ? bo
              : 999999;

          if (
            av !== bv
          ) {

            return av - bv;

          }

          const ac =
            a.created_at || "";

          const bc =
            b.created_at || "";

          if (
            ac !== bc
          ) {

            return ac.localeCompare(bc);

          }

          return (
            a.originalIndex -
            b.originalIndex
          );

        }
      );

  appData.staff =
    staffData;


  /* -------------------------------------------------------
     勤務形態
  ------------------------------------------------------- */

  const shiftResult =
    await supabaseClient
      .from("shift_types")
      .select(
        "id,name,created_at,start_time,end_time,break_time"
      );

  if (
    shiftResult.error
  ) {

    throw shiftResult.error;

  }

  appData.shiftTypes =
    (shiftResult.data || [])
      .filter(
        shift =>
          shift.name &&
          shift.name !== "明"
      )
      .map(
        shift => ({

          id:
            shift.id,

          name:
            shift.name,

          start:
            shift.start_time ||
            "",

          end:
            shift.end_time ||
            "",

          break:
            shift.break_time ||
            "",

          created_at:
            shift.created_at

        })
      );


  /* -------------------------------------------------------
     勤務データ
  ------------------------------------------------------- */

  const workResult =
    await supabaseClient
      .from("work_shifts")
      .select(
        "id,staff_name,work_date,shift_name,leave_type"
      );

  if (
    workResult.error
  ) {

    throw workResult.error;

  }

  appData.shifts =
    {};

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
            row.shift_name ||
            "",

          leaveType:
            row.leave_type ||
            ""

        };

      }
    );


  /* -------------------------------------------------------
     休暇
  ------------------------------------------------------- */

  const leaveResult =
    await supabaseClient
      .from("leave_types")
      .select(
        "id,name,color,created_at"
      );

  if (
    leaveResult.error
  ) {

    throw leaveResult.error;

  }

  appData.leaveTypes =
    (leaveResult.data || [])
      .filter(
        leave =>
          leave.name
      )
      .map(
        leave => ({

          id:
            leave.id,

          name:
            leave.name,

          color:
            leave.color ||
            "#FFD54F",

          created_at:
            leave.created_at

        })
      );


  /* -------------------------------------------------------
     休業日
  ------------------------------------------------------- */

  const holidayResult =
    await supabaseClient
      .from("company_holidays")
      .select(
        "id,name,start_date,end_date,created_at"
      );

  if (
    holidayResult.error
  ) {

    throw holidayResult.error;

  }

  appData.companyHolidays =
    (holidayResult.data || [])
      .map(
        holiday => ({

          id:
            holiday.id,

          name:
            holiday.name,

          start:
            holiday.start_date,

          end:
            holiday.end_date ||
            holiday.start_date,

          created_at:
            holiday.created_at

        })
      );


  /* -------------------------------------------------------
     明け時間
  ------------------------------------------------------- */

  const settingResult =
    await supabaseClient
      .from("app_settings")
      .select(
        "setting_name,setting_value"
      );

  if (
    !settingResult.error
  ) {

    (settingResult.data || [])
      .forEach(
        setting => {

          if (
            setting.setting_name ===
            "ake_start"
          ) {

            appData.akeTime.start =
              setting.setting_value ||
              "05:30";

          }

          if (
            setting.setting_name ===
            "ake_end"
          ) {

            appData.akeTime.end =
              setting.setting_value ||
              "11:15";

          }

        }
      );

  }

  saveLocalData();

}


/* =========================================================
   Realtime
========================================================= */

function setupRealtime() {

  if (
    !supabaseClient
  ) {

    return;

  }

  if (
    realtimeChannel
  ) {

    try {

      supabaseClient
        .removeChannel(
          realtimeChannel
        );

    } catch (error) {

      console.warn(
        error
      );

    }

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
          table: "leave_types"
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
          table: "app_settings"
        },
        scheduleRealtimeReload
      )
      .subscribe();

}


/* =========================================================
   Realtime 更新予約
========================================================= */

function scheduleRealtimeReload() {

  if (
    cloudOperationBusy
  ) {

    realtimeReloadPending =
      true;

    return;

  }

  if (
    realtimeReloadTimer
  ) {

    clearTimeout(
      realtimeReloadTimer
    );

  }

  realtimeReloadTimer =
    setTimeout(
      () => {

        reloadFromSupabase();

      },
      300
    );

}


/* =========================================================
   Realtime 再読み込み
========================================================= */

async function reloadFromSupabase() {

  if (
    !supabaseClient ||
    realtimeUpdating
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

  realtimeUpdating =
    true;

  try {

    await loadAllFromSupabase();

    renderAll();

  } catch (error) {

    console.error(
      "Realtime再読み込みエラー",
      error
    );

  } finally {

    realtimeUpdating =
      false;

  }

}


/* =========================================================
   クラウド操作終了
========================================================= */

function finishCloudOperation() {

  cloudOperationBusy =
    false;

  if (
    realtimeReloadPending
  ) {

    realtimeReloadPending =
      false;

    scheduleRealtimeReload();

  }

}


/* =========================================================
   自動同期
========================================================= */

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
          document.hidden
        ) {

          return;

        }

        if (
          cloudOperationBusy ||
          realtimeUpdating
        ) {

          return;

        }

        await reloadFromSupabase();

      },
      10000
    );

}


/* =========================================================
   表示復帰時同期
========================================================= */

function setupVisibilitySync() {

  document.addEventListener(
    "visibilitychange",
    async () => {

      if (
        !document.hidden
      ) {

        await reloadFromSupabase();

        setupRealtime();

      }

    }
  );

}


/* =========================================================
   イベント
========================================================= */

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

            const page =
              button.dataset.page;

            if (
              page
            ) {

              showPage(
                page
              );

            }

          }
        );

      }
    );


  document
    .getElementById(
      "prevMonth"
    )
    ?.addEventListener(
      "click",
      () => {

        currentDate.setMonth(
          currentDate.getMonth() - 1
        );

        renderSchedule();

      }
    );


  document
    .getElementById(
      "nextMonth"
    )
    ?.addEventListener(
      "click",
      () => {

        currentDate.setMonth(
          currentDate.getMonth() + 1
        );

        renderSchedule();

      }
    );


  document
    .getElementById(
      "addStaffButton"
    )
    ?.addEventListener(
      "click",
      addOrUpdateStaff
    );


  document
    .getElementById(
      "addShiftButton"
    )
    ?.addEventListener(
      "click",
      addOrUpdateShift
    );


  document
    .getElementById(
      "addLeaveButton"
    )
    ?.addEventListener(
      "click",
      addOrUpdateLeave
    );


  document
    .getElementById(
      "addCompanyHolidayButton"
    )
    ?.addEventListener(
      "click",
      addCompanyHoliday
    );


  document
    .getElementById(
      "saveAkeTimeButton"
    )
    ?.addEventListener(
      "click",
      saveAkeTime
    );


  document
    .getElementById(
      "calendarCancelButton"
    )
    ?.addEventListener(
      "click",
      closeCalendarModal
    );


  document
    .getElementById(
      "calendarOKButton"
    )
    ?.addEventListener(
      "click",
      subscribeStaffCalendar
    );


  document
    .getElementById(
      "deleteMonthButton"
    )
    ?.addEventListener(
      "click",
      deleteCurrentMonth
    );


  document
    .getElementById(
      "deleteFiscalYearButton"
    )
    ?.addEventListener(
      "click",
      deleteFiscalYear
    );


  document.addEventListener(
    "click",
    event => {

      const menu =
        document.getElementById(
          "shiftMenu"
        );

      if (
        !menu ||
        menu.style.display ===
          "none"
      ) {

        return;

      }

      if (
        menu.contains(
          event.target
        )
      ) {

        return;

      }

      if (
        selectedCell &&
        selectedCell.contains(
          event.target
        )
      ) {

        return;

      }

      hideShiftMenu();

    }
  );

}


/* =========================================================
   ページ表示
========================================================= */

function showPage(
  page
) {

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      element => {

        element.style.display =
          "none";

      }
    );

  const target =
    document.getElementById(
      `${page}Page`
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


  if (
    page === "schedule"
  ) {

    renderSchedule();

  }

  if (
    page === "staff"
  ) {

    renderStaffList();

  }

  if (
    page === "shift"
  ) {

    renderShiftList();

  }

  if (
    page === "leave"
  ) {

    renderLeaveList();

  }

  if (
    page === "holiday"
  ) {

    renderHolidayList();

  }

}


/* =========================================================
   全体描画
========================================================= */

function renderAll() {

  renderSchedule();

  renderStaffList();

  renderShiftList();

  renderLeaveList();

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


/* =========================================================
   日付キー
========================================================= */

function getDateKey(
  year,
  month,
  day
) {

  return (
    String(year).padStart(4, "0") +
    "-" +
    String(month).padStart(2, "0") +
    "-" +
    String(day).padStart(2, "0")
  );

}


/* =========================================================
   月の日数
========================================================= */

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


/* =========================================================
   日付表示
========================================================= */

function formatDateJP(
  dateKey
) {

  if (!dateKey) {

    return "";

  }

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


/* =========================================================
   職員名取得
========================================================= */

function getStaffName(
  staff
) {

  if (
    typeof staff ===
    "string"
  ) {

    return staff;

  }

  return (
    staff?.name ||
    ""
  );

}


/* =========================================================
   勤務取得
========================================================= */

function getStoredShift(
  staffName,
  dateKey
) {

  const name =
    getStaffName(
      staffName
    );

  return (
    appData.shifts?.[name]?.[dateKey]
      ?.shiftName ||
    ""
  );

}


/* =========================================================
   休暇取得
========================================================= */

function getStoredLeave(
  staffName,
  dateKey
) {

  const name =
    getStaffName(
      staffName
    );

  return (
    appData.shifts?.[name]?.[dateKey]
      ?.leaveType ||
    ""
  );

}


/* =========================================================
   勤務保存（ローカル）
========================================================= */

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

  appData.shifts[name][
    dateKey
  ] = {

    shiftName:
      shiftName ||
      "",

    leaveType:
      leaveType ||
      ""

  };

}


/* =========================================================
   表示勤務
========================================================= */

function getDisplayShift(
  staffName,
  dateKey
) {

  const stored =
    getStoredShift(
      staffName,
      dateKey
    );

  if (
    stored
  ) {

    return stored;

  }

  const [
    y,
    m,
    d
  ] =
    dateKey
      .split("-")
      .map(Number);

  const current =
    new Date(
      y,
      m - 1,
      d
    );

  current.setDate(
    current.getDate() - 1
  );

  const previousKey =
    getDateKey(
      current.getFullYear(),
      current.getMonth() + 1,
      current.getDate()
    );

  const previous =
    getStoredShift(
      staffName,
      previousKey
    );

  if (
    previous &&
    (
      previous.includes("宿") ||
      previous.includes("夜")
    )
  ) {

    return "明";

  }

  return "";

}


/* =========================================================
   休暇種類取得
========================================================= */

function getLeaveType(
  leaveName
) {

  return appData.leaveTypes.find(
    leave =>
      leave.name ===
      leaveName
  );

}


/* =========================================================
   休暇色
========================================================= */

function getLeaveColor(
  leaveName
) {

  if (!leaveName) {

    return "";

  }

  const leave =
    getLeaveType(
      leaveName
    );

  return (
    leave?.color ||
    ""
  );

}


/* =========================================================
   勤務名を集計用に正規化
========================================================= */

function normalizeShiftNameForTotal(
  value
) {

  const text =
    String(
      value ||
      ""
    ).trim();

  if (!text) {

    return "";

  }

  if (
    text === "明"
  ) {

    return "明";

  }

  const names =
    appData.shiftTypes
      .map(
        shift =>
          shift.name
      )
      .filter(
        name =>
          name &&
          name !== "明"
      )
      .sort(
        (a, b) =>
          b.length -
          a.length
      );

  for (
    const name of names
  ) {

    if (
      text === name
    ) {

      return name;

    }

  }

  for (
    const name of names
  ) {

    if (
      text.startsWith(name)
    ) {

      return name;

    }

  }

  return text;

}


/* =========================================================
   集計対象勤務
========================================================= */

function getTotalShiftTypes() {

  const result =
    [];

  const seen =
    new Set();

  appData.shiftTypes.forEach(
    shift => {

      const name =
        normalizeShiftNameForTotal(
          shift.name
        );

      if (
        !name ||
        name === "明" ||
        seen.has(name)
      ) {

        return;

      }

      seen.add(name);

      result.push({

        name:
          name

      });

    }
  );

  return result;

}


/* =========================================================
   休暇凡例
========================================================= */

function renderLeaveLegend() {

  let legend =
    document.getElementById(
      "leaveLegend"
    );

  const table =
    document.getElementById(
      "scheduleTable"
    );

  if (
    !table
  ) {

    return;

  }

  if (
    !legend
  ) {

    legend =
      document.createElement(
        "div"
      );

    legend.id =
      "leaveLegend";

    table.parentNode.insertBefore(
      legend,
      table.nextSibling
    );

  }

  legend.innerHTML =
    "";

  if (
    !appData.leaveTypes.length
  ) {

    legend.style.display =
      "none";

    return;

  }

  legend.style.display =
    "flex";

  legend.style.flexWrap =
    "wrap";

  legend.style.gap =
    "8px";

  legend.style.padding =
    "8px 4px";

  appData.leaveTypes.forEach(
    leave => {

      const item =
        document.createElement(
          "div"
        );

      item.style.display =
        "flex";

      item.style.alignItems =
        "center";

      item.style.gap =
        "5px";

      const swatch =
        document.createElement(
          "span"
        );

      swatch.style.width =
        "16px";

      swatch.style.height =
        "16px";

      swatch.style.borderRadius =
        "4px";

      swatch.style.background =
        leave.color ||
        "#FFD54F";

      swatch.style.border =
        "1px solid rgba(0,0,0,.15)";

      const label =
        document.createElement(
          "span"
        );

      label.textContent =
        leave.name;

      item.appendChild(
        swatch
      );

      item.appendChild(
        label
      );

      legend.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   勤務表描画
   ★固定複製テーブルは使用しない
========================================================= */

function renderSchedule() {

  const table =
    document.getElementById(
      "scheduleTable"
    );

  if (!table) {

    return;

  }


  /*
    古いバージョンで生成された
    固定レイヤーを完全削除
  */

  document
    .querySelectorAll(
      "#scheduleFixedHeader, #scheduleFixedStaffColumn"
    )
    .forEach(
      element =>
        element.remove()
    );


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


  const wrapper =
    table.closest(
      ".table-wrapper"
    );


  const isMobile =
    window.innerWidth <=
    768;


  const staffColumnWidth =
    90;

  const dateColumnWidth =
    isMobile
      ? 48
      : 52;

  const totalColumnWidth =
    isMobile
      ? 52
      : 58;


  const totalShiftTypes =
    getTotalShiftTypes();


  let html =
    "";


  /* -------------------------------------------------------
     colgroup
  ------------------------------------------------------- */

  html +=
    "<colgroup>";

  html +=
    `<col style="width:${staffColumnWidth}px">`;


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    html +=
      `<col style="width:${dateColumnWidth}px">`;

  }


  totalShiftTypes.forEach(
    () => {

      html +=
        `<col style="width:${totalColumnWidth}px">`;

      html +=
        `<col style="width:${totalColumnWidth}px">`;

    }
  );

  html +=
    "</colgroup>";


  /* -------------------------------------------------------
     thead
  ------------------------------------------------------- */

  html +=
    "<thead>";


  /* 1行目 */

  html +=
    "<tr>";


  html += `
    <th
      class="staff-header"
      rowspan="2"
      scope="col"
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

    const date =
      new Date(
        year,
        month - 1,
        day
      );

    const weekday =
      date.getDay();

    let cls =
      "date-header";

    if (
      weekday === 0
    ) {

      cls +=
        " sunday";

    }

    if (
      weekday === 6
    ) {

      cls +=
        " saturday";

    }

    if (
      isPublicHoliday(
        dateKey
      )
    ) {

      cls +=
        " public-holiday";

    }

    if (
      isCompanyHoliday(
        dateKey
      )
    ) {

      cls +=
        " company-holiday";

    }

    html += `
      <th
        class="${cls}"
        rowspan="2"
        scope="col"
      >
        <span class="schedule-day-number">
          ${day}
        </span>
        <span class="schedule-weekday">
          ${["日","月","火","水","木","金","土"][weekday]}
        </span>
      </th>
    `;

  }


  totalShiftTypes.forEach(
    shift => {

      html += `
        <th
          class="shift-header"
          colspan="2"
          scope="colgroup"
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


  /* 2行目 */

  html +=
    "<tr>";


  totalShiftTypes.forEach(
    () => {

      html += `
        <th
          class="total-header"
          scope="col"
        >
          合計
        </th>

        <th
          class="total-header cumulative-header"
          scope="col"
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


  /* -------------------------------------------------------
     tbody
  ------------------------------------------------------- */

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


      /* 職員名 */

      html += `
        <th
          class="staff-cell staff-name-cell"
          scope="row"
          data-staff-name="${escapeHtml(
            staffName
          )}"
        >
          ${escapeHtml(
            staffName
          )}
        </th>
      `;


      /* 日付 */

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

        const date =
          new Date(
            year,
            month - 1,
            day
          );

        const weekday =
          date.getDay();

        let classes =
          "schedule-cell";

        if (
          weekday === 0
        ) {

          classes +=
            " sunday";

        }

        if (
          weekday === 6
        ) {

          classes +=
            " saturday";

        }

        if (
          isPublicHoliday(
            dateKey
          )
        ) {

          classes +=
            " public-holiday";

        }

        if (
          isCompanyHoliday(
            dateKey
          )
        ) {

          classes +=
            " company-holiday";

        }


        const shift =
          getDisplayShift(
            staffName,
            dateKey
          );

        const leave =
          getStoredLeave(
            staffName,
            dateKey
          );

        const leaveColor =
          getLeaveColor(
            leave
          );


        const style =
          leaveColor
            ? `style="background:${escapeHtml(
                leaveColor
              )} !important;"`
            : "";


        html += `
          <td
            class="${classes}"
            data-staff="${escapeHtml(
              staffName
            )}"
            data-date="${dateKey}"
            ${style}
          >
            ${escapeHtml(
              shift
            )}
          </td>
        `;

      }


      /* ---------------------------------------------------
         月間・年度集計
      --------------------------------------------------- */

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
            >
              ${monthly}
            </td>

            <td
              class="total-cell cumulative-cell"
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


  table.innerHTML =
    html;


  /*
    テーブル幅
  */

  const requiredWidth =
    staffColumnWidth +
    (
      days *
      dateColumnWidth
    ) +
    (
      totalShiftTypes.length *
      2 *
      totalColumnWidth
    );


  table.style.width =
    `${requiredWidth}px`;

  table.style.minWidth =
    `${requiredWidth}px`;

  table.style.maxWidth =
    `${requiredWidth}px`;

  table.style.tableLayout =
    "fixed";

  table.style.borderCollapse =
    "separate";

  table.style.borderSpacing =
    "0";


  bindScheduleCells();

  bindStaffNameCells();

  renderLeaveLegend();

  updateScheduleStickyVariables();

}


/* =========================================================
   勤務セルイベント
========================================================= */

function bindScheduleCells() {

  document
    .querySelectorAll(
      "#scheduleTable .schedule-cell"
    )
    .forEach(
      cell => {

        cell.addEventListener(
          "click",
          event => {

            event.stopPropagation();

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


/* =========================================================
   職員名イベント
========================================================= */

function bindStaffNameCells() {

  document
    .querySelectorAll(
      "#scheduleTable .staff-name-cell"
    )
    .forEach(
      cell => {

        cell.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            openCalendarConfirm(
              cell.dataset.staffName
            );

          }
        );

      }
    );

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


  /* =======================================================
     勤務モード
  ======================================================= */

  if (
    shiftMenuMode ===
    "shift"
  ) {

    const title =
      menu.querySelector(
        ".shift-menu-title"
      );

    if (title) {

      title.textContent =
        "勤務を選択";

    }


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
          async event => {

            event.stopPropagation();

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


    /* -------------------------------------------------------
       勤務削除
    ------------------------------------------------------- */

    const deleteButton =
      document.createElement(
        "button"
      );

    deleteButton.type =
      "button";

    deleteButton.textContent =
      "勤務を削除";

    deleteButton.className =
      "shift-menu-button";

    deleteButton.style.gridColumn =
      "1 / -1";

    deleteButton.style.width =
      "100%";

    deleteButton.style.background =
      "#7b61b8";

    deleteButton.style.color =
      "#ffffff";

    deleteButton.addEventListener(
      "click",
      async event => {

        event.stopPropagation();

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


    /* -------------------------------------------------------
       休暇
    ------------------------------------------------------- */

    const leaveButton =
      document.createElement(
        "button"
      );

    leaveButton.type =
      "button";

    leaveButton.textContent =
      "休暇";

    leaveButton.className =
      "shift-menu-button";

    leaveButton.style.gridColumn =
      "1 / -1";

    leaveButton.style.width =
      "100%";

    leaveButton.style.background =
      "#e8f5e9";

    leaveButton.style.color =
      "#218739";

    leaveButton.style.borderColor =
      "#a5d6a7";

    leaveButton.style.fontWeight =
      "700";

    leaveButton.addEventListener(
      "click",
      event => {

        event.stopPropagation();

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


    /* -------------------------------------------------------
       キャンセル
    ------------------------------------------------------- */

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

    cancelButton.style.gridColumn =
      "1 / -1";

    cancelButton.style.width =
      "100%";

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
      event => {

        event.stopPropagation();

        hideShiftMenu();

      }
    );

    buttons.appendChild(
      cancelButton
    );

  }


  /* =======================================================
     休暇モード
  ======================================================= */

  else {

    const title =
      menu.querySelector(
        ".shift-menu-title"
      );

    if (title) {

      title.textContent =
        "🏖️ 休暇を選択";

    }


    if (
      !appData.leaveTypes.length
    ) {

      const empty =
        document.createElement(
          "div"
        );

        empty.textContent =
          "休暇が登録されていません";

        empty.style.gridColumn =
          "1 / -1";

        empty.style.padding =
          "10px";

        buttons.appendChild(
          empty
        );

    }


    appData.leaveTypes.forEach(
      leave => {

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.textContent =
          leave.name;

        button.className =
          "shift-menu-button";

        button.style.background =
          leave.color ||
          "#FFD54F";

        button.style.color =
          getTextColorForBackground(
            leave.color
          );

        button.addEventListener(
          "click",
          async event => {

            event.stopPropagation();

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


    /* -------------------------------------------------------
       休暇解除
    ------------------------------------------------------- */

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

    removeLeaveButton.style.gridColumn =
      "1 / -1";

    removeLeaveButton.style.width =
      "100%";

    removeLeaveButton.addEventListener(
      "click",
      async event => {

        event.stopPropagation();

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


    /* -------------------------------------------------------
       勤務選択へ戻る
    ------------------------------------------------------- */

    const backButton =
      document.createElement(
        "button"
      );

    backButton.type =
      "button";

    backButton.textContent =
      "勤務を選択";

    backButton.className =
      "shift-menu-button";

    backButton.style.gridColumn =
      "1 / -1";

    backButton.style.width =
      "100%";

    backButton.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        shiftMenuMode =
          "shift";

        showShiftMenu(
          cell,
          staffName,
          dateKey
        );

      }
    );

    buttons.appendChild(
      backButton
    );


    /* -------------------------------------------------------
       キャンセル
    ------------------------------------------------------- */

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

    cancelButton.style.gridColumn =
      "1 / -1";

    cancelButton.style.width =
      "100%";

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
      event => {

        event.stopPropagation();

        hideShiftMenu();

      }
    );

    buttons.appendChild(
      cancelButton
    );

  }


  /* =======================================================
     メニュー位置
  ======================================================= */

  menu.style.display =
    "grid";

  menu.style.position =
    "fixed";

  menu.style.zIndex =
    "9999";


  const rect =
    cell.getBoundingClientRect();

  const menuWidth =
    Math.min(
      190,
      window.innerWidth - 20
    );

  menu.style.width =
    `${menuWidth}px`;


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

    left =
      10;

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

    top =
      10;

  }


  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

}


/* =========================================================
   メニュー閉じる
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

  selectedCell =
    null;

  shiftMenuMode =
    "shift";

}


/* =========================================================
   勤務保存
========================================================= */

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


    /* -------------------------------------------------------
       勤務削除
    ------------------------------------------------------- */

    if (!shiftName) {

      if (
        existingRow
      ) {

        if (
          existingRow.leave_type
        ) {

          const result =
            await supabaseClient
              .from("work_shifts")
              .update({

                shift_name:
                  "",

                leave_type:
                  existingRow.leave_type

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

          setStoredShift(
            name,
            dateKey,
            "",
            existingRow.leave_type
          );

        } else {

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

          setStoredShift(
            name,
            dateKey,
            "",
            ""
          );

        }

      }

      renderSchedule();

      return;

    }


    const leaveType =
      existingRow
        ? existingRow.leave_type ||
          ""
        : "";


    /* -------------------------------------------------------
       更新
    ------------------------------------------------------- */

    if (
      existingRow
    ) {

      const result =
        await supabaseClient
          .from("work_shifts")
          .update({

            shift_name:
              shiftName,

            leave_type:
              leaveType ||
              null

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

    }


    /* -------------------------------------------------------
       新規
    ------------------------------------------------------- */

    else {

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

    finishCloudOperation();

  }

}


/* =========================================================
   休暇保存
========================================================= */

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


    /* -------------------------------------------------------
       休暇解除
    ------------------------------------------------------- */

    if (!leaveName) {

      if (
        row
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


    /* -------------------------------------------------------
       既存勤務あり
    ------------------------------------------------------- */

    if (
      row
    ) {

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

    }


    /* -------------------------------------------------------
       勤務なし
    ------------------------------------------------------- */

    else {

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

    finishCloudOperation();

  }

}


/* =========================================================
   背景色から文字色
========================================================= */

function getTextColorForBackground(
  color
) {

  if (!color) {

    return "#000000";

  }

  const hex =
    String(color)
      .replace(
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
    ) / 1000;

  return brightness > 155
    ? "#000000"
    : "#ffffff";

}


/* =========================================================
   月間集計
========================================================= */

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

    const normalized =
      normalizeShiftNameForTotal(
        display
      );

    if (
      normalized ===
        targetShift &&
      normalized !==
        "明"
    ) {

      total++;

    }

  }

  return total;

}


/* =========================================================
   年度累計
========================================================= */

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

    const normalized =
      normalizeShiftNameForTotal(
        display
      );

    if (
      normalized ===
        targetShift &&
      normalized !==
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


/* =========================================================
   職員追加・編集
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

  if (
    duplicate
  ) {

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
          (
            max,
            staff
          ) => {

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

    finishCloudOperation();

  }

}


/* =========================================================
   職員並び順保存
========================================================= */

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


/* =========================================================
   職員移動
========================================================= */

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
      (
        staff,
        i
      ) => ({

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

    finishCloudOperation();

  }

}


/* =========================================================
   職員一覧
========================================================= */

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
    (
      staff,
      index
    ) => {

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
            ${index === 0 ? "disabled" : ""}
          >
            ↑
          </button>

          <button
            type="button"
            class="list-button move-staff-down-button"
            ${index === appData.staff.length - 1 ? "disabled" : ""}
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

              finishCloudOperation();

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


/* =========================================================
   勤務形態追加・編集
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
      (
        shift,
        index
      ) =>
        shift.name === name &&
        index !==
          editingShiftIndex
    );

  if (
    duplicate
  ) {

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
              start ||
              null,

            end_time:
              end ||
              null,

            break_time:
              breakTime ||
              null

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
              start ||
              null,

            end_time:
              end ||
              null,

            break_time:
              breakTime ||
              null

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

    finishCloudOperation();

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

  list.innerHTML =
    "";

  appData.shiftTypes.forEach(
    (
      shift,
      index
    ) => {

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

            if (name) {

              name.value =
                shift.name;

            }

            if (start) {

              start.value =
                shift.start ||
                "";

            }

            if (end) {

              end.value =
                shift.end ||
                "";

            }

            if (breakInput) {

              breakInput.value =
                shift.break ||
                "";

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

              finishCloudOperation();

            }

          }
        );


      list.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   休暇追加・編集
========================================================= */

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

  if (
    duplicate
  ) {

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

    finishCloudOperation();

  }

}


/* =========================================================
   休暇一覧
========================================================= */

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

              finishCloudOperation();

            }

          }
        );


      list.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   休業設定
========================================================= */

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
      holiday =>
        (
          !editingHolidayId ||
          String(holiday.id) !==
            String(editingHolidayId)
        ) &&
        start <= holiday.end &&
        end >= holiday.start
    );


  if (
    overlap
  ) {

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


    const button =
      document.getElementById(
        "addCompanyHolidayButton"
      );

    if (button) {

      button.textContent =
        "休業を登録";

    }


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

    finishCloudOperation();

  }

}


/* =========================================================
   休業一覧
========================================================= */

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

            const name =
              document.getElementById(
                "companyHolidayName"
              );

            const start =
              document.getElementById(
                "companyHolidayStart"
              );

            const end =
              document.getElementById(
                "companyHolidayEnd"
              );

            if (name) {

              name.value =
                holiday.name;

            }

            if (start) {

              start.value =
                holiday.start;

            }

            if (end) {

              end.value =
                holiday.start ===
                holiday.end
                  ? ""
                  : holiday.end;

            }

            editingHolidayId =
              holiday.id;

            const button =
              document.getElementById(
                "addCompanyHolidayButton"
              );

            if (button) {

              button.textContent =
                "休業を更新";

            }

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

              finishCloudOperation();

            }

          }
        );


      list.appendChild(
        item
      );

    }
  );

}


/* =========================================================
   明け時間
========================================================= */

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

    cloudOperationBusy =
      true;

    try {

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

    } finally {

      finishCloudOperation();

    }

  }


  alert(
    "明け時間を保存しました"
  );

}


/* =========================================================
   カレンダー確認
========================================================= */

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


/* =========================================================
   Webcal
========================================================= */

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
    ★ ICSではなくWebcal
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

}


/* =========================================================
   月削除
========================================================= */

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

    finishCloudOperation();

  }

}


/* =========================================================
   年度削除
========================================================= */

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

    finishCloudOperation();

  }

}


/* =========================================================
   祝日API
========================================================= */

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


/* =========================================================
   公休日判定
========================================================= */

function isPublicHoliday(
  dateKey
) {

  return Boolean(
    publicHolidays &&
    publicHolidays[dateKey]
  );

}


/* =========================================================
   休業日判定
========================================================= */

function isCompanyHoliday(
  dateKey
) {

  return appData.companyHolidays.some(
    holiday =>
      dateKey >= holiday.start &&
      dateKey <= holiday.end
  );

}


/* =========================================================
   休業取得
========================================================= */

function getCompanyHoliday(
  dateKey
) {

  return appData.companyHolidays.find(
    holiday =>
      dateKey >= holiday.start &&
      dateKey <= holiday.end
  );

}


/* =========================================================
   HTMLエスケープ
========================================================= */

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


/* =========================================================
   文字列を安全なCSS色として扱う
========================================================= */

function escapeCssColor(
  value
) {

  const color =
    String(
      value ||
      ""
    ).trim();

  if (
    /^#[0-9a-fA-F]{6}$/.test(
      color
    )
  ) {

    return color;

  }

  if (
    /^#[0-9a-fA-F]{3}$/.test(
      color
    )
  ) {

    return color;

  }

  return "#FFD54F";

}


/* =========================================================
   ========================================================
   ★ スクロール・固定表示用CSS
   ========================================================
========================================================= */

function injectScheduleStyles() {

  const old =
    document.getElementById(
      "scheduleStickyStyle"
    );

  if (old) {

    old.remove();

  }


  const style =
    document.createElement(
      "style"
    );

  style.id =
    "scheduleStickyStyle";


  style.textContent = `

    /* =====================================================
       勤務表横スクロール
    ===================================================== */

    .table-wrapper {
      position: relative !important;
      overflow-x: auto !important;
      overflow-y: visible !important;
      -webkit-overflow-scrolling: touch;
    }


    /* =====================================================
       テーブル
    ===================================================== */

    #scheduleTable {
      border-collapse: separate !important;
      border-spacing: 0 !important;
      table-layout: fixed !important;
      position: relative;
    }


    /* =====================================================
       ★ ヘッダー
       縦方向だけ固定
    ===================================================== */

    #scheduleTable thead th {
      position: sticky !important;
      opacity: 1 !important;
      background-clip: padding-box !important;
      box-sizing: border-box !important;
    }


    /*
      1行目
    */

    #scheduleTable thead tr:first-child th {
      top: var(
        --schedule-sticky-top,
        0px
      ) !important;

      z-index: 300 !important;
    }


    /*
      2行目
    */

    #scheduleTable thead tr:nth-child(2) th {
      top: calc(
        var(--schedule-sticky-top, 0px)
        +
        var(--schedule-head-row1-height, 32px)
      ) !important;

      z-index: 290 !important;
    }


    /* =====================================================
       左上「職員」
       ★縦・横どちらも固定
    ===================================================== */

    #scheduleTable
    thead
    th.staff-header {

      position: sticky !important;

      left: 0 !important;

      top: var(
        --schedule-sticky-top,
        0px
      ) !important;

      z-index: 500 !important;

      background:
        #f2f2f7 !important;

      opacity: 1 !important;

      isolation: isolate;
    }


    /* =====================================================
       職員名
       ★横方向だけ固定
       ★縦方向には固定しない
    ===================================================== */

    #scheduleTable
    tbody
    th.staff-name-cell {

      position: sticky !important;

      left: 0 !important;

      top: auto !important;

      z-index: 200 !important;

      background:
        #ffffff !important;

      opacity: 1 !important;

      isolation: isolate;

      box-shadow:
        2px 0 0 rgba(0,0,0,.08);
    }


    /* =====================================================
       日付ヘッダー
    ===================================================== */

    #scheduleTable
    thead
    th.date-header {

      background:
        #f8f8fa !important;

      opacity: 1 !important;
    }


    #scheduleTable
    thead
    th.date-header.sunday,
    #scheduleTable
    thead
    th.date-header.public-holiday {

      background:
        #fff0f0 !important;
    }


    #scheduleTable
    thead
    th.date-header.saturday {

      background:
        #f0f6ff !important;
    }


    #scheduleTable
    thead
    th.date-header.company-holiday {

      background:
        #fff7e6 !important;
    }


    /* =====================================================
       勤務形態ヘッダー
    ===================================================== */

    #scheduleTable
    thead
    th.shift-header {

      background:
        #f2f2f7 !important;

      opacity: 1 !important;

      white-space: nowrap;
    }


    /* =====================================================
       合計・累計ヘッダー
    ===================================================== */

    #scheduleTable
    thead
    th.total-header {

      background:
        #ffffff !important;

      opacity: 1 !important;

      color:
        #333333 !important;

      white-space: nowrap;
    }


    /* =====================================================
       tbody
    ===================================================== */

    #scheduleTable
    tbody
    td,
    #scheduleTable
    tbody
    th {

      background-clip:
        padding-box !important;
    }


    /* =====================================================
       通常セル
    ===================================================== */

    #scheduleTable
    tbody
    td.schedule-cell {

      background-color:
        #ffffff;

      opacity: 1;

    }


    #scheduleTable
    tbody
    td.schedule-cell.sunday,
    #scheduleTable
    tbody
    td.schedule-cell.public-holiday {

      background-color:
        #fff7f7;
    }


    #scheduleTable
    tbody
    td.schedule-cell.saturday {

      background-color:
        #f6f9ff;
    }


    #scheduleTable
    tbody
    td.schedule-cell.company-holiday {

      background-color:
        #fffaf0;
    }


    /* =====================================================
       休暇色は最優先
    ===================================================== */

    #scheduleTable
    tbody
    td.schedule-cell[style*="background"] {

      opacity: 1 !important;
    }


    /* =====================================================
       合計セル
    ===================================================== */

    #scheduleTable
    tbody
    td.total-cell {

      background:
        #ffffff !important;

      opacity: 1 !important;

      text-align: center;

      font-weight: 600;

      white-space: nowrap;
    }


    /* =====================================================
       境界線
    ===================================================== */

    #scheduleTable
    th,
    #scheduleTable
    td {

      border-right:
        1px solid #d9d9df;

      border-bottom:
        1px solid #d9d9df;

      box-sizing:
        border-box;
    }


    #scheduleTable
    thead
    tr:first-child
    th {

      border-top:
        1px solid #d9d9df;
    }


    /* =====================================================
       固定列の右境界
    ===================================================== */

    #scheduleTable
    .staff-header,
    #scheduleTable
    .staff-name-cell {

      border-right:
        2px solid #c9c9cf !important;
    }


    /* =====================================================
       古い固定レイヤーを完全に無効化
    ===================================================== */

    #scheduleFixedHeader,
    #scheduleFixedStaffColumn {

      display:
        none !important;

    }

  `;


  document.head.appendChild(
    style
  );

}


/* =========================================================
   sticky位置計算
========================================================= */

function updateScheduleStickyVariables() {

  const table =
    document.getElementById(
      "scheduleTable"
    );

  if (!table) {

    return;

  }


  let topOffset =
    0;


  /*
    アプリ上部ヘッダーが
    fixed / sticky の場合に対応
  */

  const header =
    document.querySelector(
      ".header"
    );

  if (header) {

    const rect =
      header.getBoundingClientRect();

    const style =
      window.getComputedStyle(
        header
      );

    const position =
      style.position;


    if (
      position === "fixed" ||
      position === "sticky"
    ) {

      if (
        rect.bottom > 0
      ) {

        topOffset =
          rect.bottom;

      }

    }

  }


  table.style.setProperty(
    "--schedule-sticky-top",
    `${topOffset}px`
  );


  const firstRow =
    table.querySelector(
      "thead tr:first-child"
    );

  if (
    firstRow
  ) {

    const height =
      firstRow.getBoundingClientRect()
        .height;

    table.style.setProperty(
      "--schedule-head-row1-height",
      `${height}px`
    );

  }

}


/* =========================================================
   resize
========================================================= */

window.addEventListener(
  "resize",
  () => {

    updateScheduleStickyVariables();

  }
);


/* =========================================================
   scroll
========================================================= */

window.addEventListener(
  "scroll",
  () => {

    updateScheduleStickyVariables();

  },
  {
    passive: true
  }
);


/* =========================================================
   ICS関連
   ※Webcal登録とは別に残しておく
========================================================= */

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

    if (
      leaveName
    ) {

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


/* =========================================================
   ICS 全日イベント
========================================================= */

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


/* =========================================================
   ICS 時間イベント
========================================================= */

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


/* =========================================================
   日時作成
========================================================= */

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


/* =========================================================
   UTC
========================================================= */

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


/* =========================================================
   現在UTC
========================================================= */

function utcNow() {

  return formatUTC(
    new Date()
  );

}


/* =========================================================
   翌日
========================================================= */

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


/* =========================================================
   他職員勤務
========================================================= */

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


      if (
        shift
      ) {

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


/* =========================================================
   ICSエスケープ
========================================================= */

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
