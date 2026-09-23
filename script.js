"use strict";

/* =========================================================
   基本設定
========================================================= */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

const LOCAL_STORAGE_KEY =
  "workScheduleAppData";

const $ = id =>
  document.getElementById(id);

const $$ = selector =>
  Array.from(
    document.querySelectorAll(selector)
  );


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


let appData =
  defaultAppData();


let currentDate =
  new Date();

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

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      forceCloseMenus();

      initSupabase();

      loadLocal();

      bindEvents();

      renderAll();

      await loadAllFromSupabase();

      startAutoSync();

      showPage("schedule");

    } catch (error) {

      console.error(
        "起動エラー",
        error
      );

      setStatus(
        "起動エラー"
      );

    }

  }
);


/* =========================================================
   Supabase
========================================================= */

function initSupabase() {

  if (
    !window.supabase ||
    !window.supabase.createClient
  ) {

    setStatus(
      "Supabase読み込みエラー"
    );

    return;

  }

  supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

}


/* =========================================================
   Supabase読み込み
========================================================= */

async function loadAllFromSupabase(
  silent = false
) {

  if (
    !supabaseClient ||
    cloudOperationBusy
  ) {

    return;

  }

  cloudOperationBusy = true;

  try {

    const [

      staffResult,

      shiftResult,

      leaveTypeResult,

      holidayResult,

      workResult,

      settingResult

    ] = await Promise.all([

      supabaseClient
        .from("staff")
        .select(
          "id,name,created_at,sort_order,calendar_token"
        )
        .order(
          "sort_order",
          {
            ascending: true,
            nullsFirst: false
          }
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        ),

      supabaseClient
        .from("shift_types")
        .select(
          "id,name,created_at,start_time,end_time,break_time"
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        ),

      supabaseClient
        .from("leave_types")
        .select(
          "id,name,color,created_at"
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        ),

      supabaseClient
        .from("company_holidays")
        .select(
          "id,name,start_date,end_date,created_at"
        )
        .order(
          "start_date",
          {
            ascending: true
          }
        ),

      supabaseClient
        .from("work_shifts")
        .select(
          "id,staff_name,work_date,shift_name,leave_type"
        )
        .order(
          "work_date",
          {
            ascending: true
          }
        ),

      supabaseClient
        .from("app_settings")
        .select(
          "key,value"
        )

    ]);


    if (staffResult.error)
      throw staffResult.error;

    if (shiftResult.error)
      throw shiftResult.error;

    if (leaveTypeResult.error)
      throw leaveTypeResult.error;

    if (holidayResult.error)
      throw holidayResult.error;

    if (workResult.error)
      throw workResult.error;


    const staff =
      (staffResult.data || [])
        .filter(
          item =>
            item.name &&
            item.name !== "明"
        );


    const shifts = {};

    const leaves = {};


    (workResult.data || [])
      .forEach(
        row => {

          const staffName =
            row.staff_name;

          const date =
            row.work_date;

          if (
            !staffName ||
            !date
          ) {

            return;

          }


          if (row.shift_name) {

            if (
              !shifts[staffName]
            ) {

              shifts[staffName] = {};

            }

            shifts[staffName][date] =
              row.shift_name;

          }


          if (row.leave_type) {

            if (
              !leaves[staffName]
            ) {

              leaves[staffName] = {};

            }

            leaves[staffName][date] =
              row.leave_type;

          }

        }
      );


    let akeStart =
      "05:30";

    let akeEnd =
      "11:15";


    (
      settingResult.data || []
    ).forEach(
      row => {

        if (
          row.key === "ake_start"
        ) {

          akeStart =
            row.value ||
            akeStart;

        }

        if (
          row.key === "ake_end"
        ) {

          akeEnd =
            row.value ||
            akeEnd;

        }

      }
    );


    appData = {

      staff,

      shiftTypes:
        shiftResult.data || [],

      leaveTypes:
        leaveTypeResult.data || [],

      companyHolidays:
        holidayResult.data || [],

      shifts,

      leaves,

      akeTime: {

        start: akeStart,

        end: akeEnd

      }

    };


    saveLocal();

    renderAll();


    if (!silent) {

      setStatus(
        "最新データを読み込みました"
      );

    }


  } catch (error) {

    console.error(
      "loadAllFromSupabase",
      error
    );


    if (!silent) {

      setStatus(
        "クラウド読み込みエラー"
      );

    }


  } finally {

    cloudOperationBusy = false;

  }

}


/* =========================================================
   LocalStorage
========================================================= */

function saveLocal() {

  try {

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(appData)
    );

  } catch (error) {

    console.error(
      "local save",
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

    if (!saved)
      return;


    const parsed =
      JSON.parse(saved);


    appData = {

      ...defaultAppData(),

      ...parsed

    };


  } catch (error) {

    console.error(
      "local load",
      error
    );

    appData =
      defaultAppData();

  }

}


/* =========================================================
   ステータス
========================================================= */

function setStatus(
  message
) {

  const element =
    $("appStatus");

  if (!element)
    return;

  element.textContent =
    message;

}


/* =========================================================
   イベント
========================================================= */

function bindEvents() {

  $$(".nav-button")
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


  $("prevMonth")
    ?.addEventListener(
      "click",
      () => {

        forceCloseMenus();

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

        forceCloseMenus();

        currentDate.setMonth(
          currentDate.getMonth() + 1
        );

        renderSchedule();

      }
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


  $("calendarCancelButton")
    ?.addEventListener(
      "click",
      closeCalendarModal
    );


  $("calendarOKButton")
    ?.addEventListener(
      "click",
      subscribeStaffCalendar
    );


  document.addEventListener(
    "click",
    handleDocumentClick
  );


  window.addEventListener(
    "resize",
    () => {

      forceCloseMenus();

    }
  );


  window.addEventListener(
    "orientationchange",
    () => {

      forceCloseMenus();

    }
  );


  window.addEventListener(
    "scroll",
    () => {

      forceCloseMenus();

    },
    true
  );


  setupRealtime();

}


/* =========================================================
   ページ
========================================================= */

function showPage(
  pageName
) {

  forceCloseMenus();

  $$(".page")
    .forEach(
      page => {

        page.style.display =
          "none";

      }
    );


  const page =
    $(
      pageName +
      "Page"
    );


  if (page) {

    page.style.display =
      "block";

  }


  $$(".nav-button")
    .forEach(
      button => {

        button.classList.toggle(
          "active",
          button.dataset.page ===
            pageName
        );

      }
    );


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


/* =========================================================
   ヘルパー
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


function pad2(
  value
) {

  return String(
    value
  ).padStart(
    2,
    "0"
  );

}


function dateKey(
  year,
  month,
  day
) {

  return (

    year +
    "-" +
    pad2(month) +
    "-" +
    pad2(day)

  );

}


function getMonthDays() {

  return new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();

}


function formatDateJapanese(
  key
) {

  const [
    year,
    month,
    day
  ] =
    key
      .split("-")
      .map(Number);


  return (

    year +
    "年" +
    month +
    "月" +
    day +
    "日"

  );

}


function getWeekday(
  year,
  month,
  day
) {

  return new Date(
    year,
    month - 1,
    day
  ).getDay();

}


/* =========================================================
   祝日
========================================================= */

async function loadPublicHolidays() {

  try {

    const response =
      await fetch(
        "https://holidays-jp.github.io/api/v1/date.json"
      );


    if (!response.ok)
      return;


    publicHolidays =
      await response.json();


    /*
      祝日読み込み後に
      メニューが出ないようにする
    */

    forceCloseMenus();

    renderSchedule();


  } catch (error) {

    console.warn(
      "祝日取得失敗",
      error
    );

  }

}


function isPublicHoliday(
  date
) {

  return Boolean(
    publicHolidays[date]
  );

}


function isCompanyHoliday(
  date
) {

  return appData
    .companyHolidays
    .some(
      holiday => (

        date >= holiday.start_date &&
        date <= holiday.end_date

      )
    );

}


/* =========================================================
   明
========================================================= */

function isNightShiftName(
  shiftName
) {

  if (!shiftName)
    return false;


  return (

    String(
      shiftName
    ).includes("宿") ||

    String(
      shiftName
    ).includes("夜")

  );

}


function shouldShowAke(
  staffName,
  date
) {

  const [
    year,
    month,
    day
  ] =
    date
      .split("-")
      .map(Number);


  const previous =
    new Date(
      year,
      month - 1,
      day - 1
    );


  const previousKey =
    dateKey(
      previous.getFullYear(),
      previous.getMonth() + 1,
      previous.getDate()
    );


  const previousShift =
    appData
      .shifts?.[
        staffName
      ]?.[
        previousKey
      ];


  return isNightShiftName(
    previousShift
  );

}


/* =========================================================
   勤務表
   ★ 合計・累計付き
========================================================= */

function renderSchedule() {

  forceCloseMenus();


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
    currentDate.getMonth() + 1;

  const days =
    getMonthDays();


  if (monthLabel) {

    monthLabel.textContent =
      `${year}年${month}月`;

  }


  /*
    ==========================================
    ヘッダー
    ==========================================
  */

  let headerHtml = `

    <th class="staff-header">
      職員
    </th>

  `;


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const key =
      dateKey(
        year,
        month,
        day
      );


    const week =
      getWeekday(
        year,
        month,
        day
      );


    let cls =
      "date-header";


    if (
      isCompanyHoliday(key)
    ) {

      cls +=
        " company-holiday";

    }

    else if (
      week === 0 ||
      isPublicHoliday(key)
    ) {

      cls +=
        " sunday";

    }

    else if (
      week === 6
    ) {

      cls +=
        " saturday";

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
      ][week];


    headerHtml += `

      <th
        class="${cls}"
      >

        <span class="day-number">
          ${day}
        </span>

        <span class="weekday">
          ${weekday}
        </span>

      </th>

    `;

  }


  /*
    ★ 月間合計
  */

  appData.shiftTypes
    .forEach(
      shift => {

        headerHtml += `

          <th
            class="summary-header summary-month"
          >

            ${escapeHtml(
              shift.name
            )}

            <small>
              合計
            </small>

          </th>

        `;

      }
    );


  /*
    ★ 累計
  */

  appData.shiftTypes
    .forEach(
      shift => {

        headerHtml += `

          <th
            class="summary-header summary-total"
          >

            ${escapeHtml(
              shift.name
            )}

            <small>
              累計
            </small>

          </th>

        `;

      }
    );


  header.innerHTML =
    headerHtml;


  /*
    ==========================================
    本体
    ==========================================
  */

  let bodyHtml =
    "";


  appData.staff.forEach(
    staff => {

      const name =
        staff.name;


      /*
        月間集計
      */

      const monthlyCounts =
        countShiftsForMonth(
          name,
          year,
          month
        );


      /*
        年度累計
      */

      const cumulativeCounts =
        countShiftsForFiscalYear(
          name,
          year,
          month
        );


      bodyHtml += `

        <tr>

          <td
            class="staff-name-cell"
          >

            <button
              type="button"
              class="staff-calendar-button"
              data-calendar-staff="${escapeHtml(
                name
              )}"
            >

              ${escapeHtml(
                name
              )}

            </button>

          </td>

      `;


      /*
        日付セル
      */

      for (
        let day = 1;
        day <= days;
        day++
      ) {

        const key =
          dateKey(
            year,
            month,
            day
          );


        const week =
          getWeekday(
            year,
            month,
            day
          );


        const shift =
          appData
            .shifts?.[
              name
            ]?.[
              key
            ] || "";


        const leave =
          appData
            .leaves?.[
              name
            ]?.[
              key
            ] || "";


        let cls =
          "schedule-cell";


        if (
          isCompanyHoliday(key)
        ) {

          cls +=
            " company-holiday-cell";

        }

        else if (
          week === 0 ||
          isPublicHoliday(key)
        ) {

          cls +=
            " sunday holiday-cell";

        }

        else if (
          week === 6
        ) {

          cls +=
            " saturday";

        }


        if (leave) {

          cls +=
            " leave-cell";

        }


        let style = "";


        if (leave) {

          const leaveType =
            getLeaveType(
              leave
            );


          if (
            leaveType &&
            leaveType.color
          ) {

            style =
              `style="background:${escapeHtml(
                leaveType.color
              )}"`;

          }

        }


        let value = "";


        if (shift) {

          value =
            escapeHtml(
              shift
            );

        }

        else if (leave) {

          value =
            escapeHtml(
              leave
            );

        }

        else if (
          shouldShowAke(
            name,
            key
          )
        ) {

          value = `

            <span class="ake-cell">

              <span class="ake-label">
                明
              </span>

              <span class="ake-time">
                ${escapeHtml(
                  appData.akeTime.start
                )}
                ～
                ${escapeHtml(
                  appData.akeTime.end
                )}
              </span>

            </span>

          `;

        }


        bodyHtml += `

          <td
            class="${cls}"
            ${style}
            data-staff="${escapeHtml(
              name
            )}"
            data-date="${key}"
          >

            <button
              type="button"
              class="schedule-cell-button"
            >

              ${value}

            </button>

          </td>

        `;

      }


      /*
        ======================================
        ★ 月間合計
        ======================================
      */

      appData.shiftTypes
        .forEach(
          shift => {

            const count =
              monthlyCounts[
                shift.name
              ] || 0;


            bodyHtml += `

              <td
                class="summary-cell summary-month-cell"
              >

                ${count}

              </td>

            `;

          }
        );


      /*
        ======================================
        ★ 累計
        ======================================
      */

      appData.shiftTypes
        .forEach(
          shift => {

            const count =
              cumulativeCounts[
                shift.name
              ] || 0;


            bodyHtml += `

              <td
                class="summary-cell summary-total-cell"
              >

                ${count}

              </td>

            `;

          }
        );


      bodyHtml +=
        "</tr>";

    }
  );


  /*
    ★ 人数行は作らない
  */

  body.innerHTML =
    bodyHtml;


  /*
    ==========================================
    セルイベント
    ==========================================
  */

  $$(".schedule-cell")
    .forEach(
      cell => {

        cell.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            showShiftMenu(
              cell,
              cell.dataset.staff,
              cell.dataset.date
            );

          }
        );

      }
    );


  /*
    職員名
  */

  $$(".staff-calendar-button")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          event => {

            event.stopPropagation();


            openCalendarModal(
              button.dataset.calendarStaff
            );

          }
        );

      }
    );


  /*
    祝日取得
  */

  if (
    Object.keys(
      publicHolidays
    ).length === 0
  ) {

    loadPublicHolidays();

  }

}


/* =========================================================
   月間集計
========================================================= */

function countShiftsForMonth(
  staffName,
  year,
  month
) {

  const result = {};


  appData.shiftTypes
    .forEach(
      shift => {

        result[
          shift.name
        ] = 0;

      }
    );


  const days =
    new Date(
      year,
      month,
      0
    ).getDate();


  for (
    let day = 1;
    day <= days;
    day++
  ) {

    const key =
      dateKey(
        year,
        month,
        day
      );


    const shift =
      appData
        .shifts?.[
          staffName
        ]?.[
          key
        ];


    if (
      shift &&
      result[
        shift
      ] !== undefined
    ) {

      result[
        shift
      ]++;

    }

  }


  return result;

}


/* =========================================================
   年度累計
   4月～現在表示月
========================================================= */

function countShiftsForFiscalYear(
  staffName,
  displayYear,
  displayMonth
) {

  const result = {};


  appData.shiftTypes
    .forEach(
      shift => {

        result[
          shift.name
        ] = 0;

      }
    );


  /*
    4月始まり
  */

  let fiscalStartYear =
    displayYear;


  if (
    displayMonth < 4
  ) {

    fiscalStartYear =
      displayYear - 1;

  }


  const fiscalStart =
    new Date(
      fiscalStartYear,
      3,
      1
    );


  const fiscalEnd =
    new Date(
      displayYear,
      displayMonth,
      0
    );


  let cursor =
    new Date(
      fiscalStart
    );


  while (
    cursor <= fiscalEnd
  ) {

    const key =
      dateKey(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        cursor.getDate()
      );


    const shift =
      appData
        .shifts?.[
          staffName
        ]?.[
          key
        ];


    if (
      shift &&
      result[
        shift
      ] !== undefined
    ) {

      result[
        shift
      ]++;

    }


    cursor.setDate(
      cursor.getDate() + 1
    );

  }


  return result;

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


  selectedCell = {

    cell,

    staffName,

    date

  };


  const menu =
    $("shiftMenu");

  const buttons =
    $("shiftMenuButtons");

  const title =
    $("shiftMenuTitle");


  if (
    !menu ||
    !buttons
  ) {

    return;

  }


  if (title) {

    title.textContent =
      `${formatDateJapanese(
        date
      )}　${staffName}`;

  }


  buttons.innerHTML =
    "";


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
          "shift-option";


        button.textContent =
          shift.name;


        button.addEventListener(
          "click",
          async event => {

            event.stopPropagation();


            await setWorkShift(
              staffName,
              date,
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


  const clearButton =
    document.createElement(
      "button"
    );


  clearButton.type =
    "button";


  clearButton.textContent =
    "勤務をクリア";


  clearButton.className =
    "menu-wide menu-danger";


  clearButton.addEventListener(
    "click",
    async event => {

      event.stopPropagation();


      await clearWorkShift(
        staffName,
        date
      );


      closeShiftMenu();

    }
  );


  buttons.appendChild(
    clearButton
  );


  const leaveButton =
    document.createElement(
      "button"
    );


  leaveButton.type =
    "button";


  leaveButton.textContent =
    "休暇を選択";


  leaveButton.className =
    "menu-wide menu-leave";


  leaveButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();


      closeShiftMenu();


      showLeaveMenu(
        cell,
        staffName,
        date
      );

    }
  );


  buttons.appendChild(
    leaveButton
  );


  /*
    ★ 右 → 左
  */

  positionMenuFromCell(
    menu,
    cell
  );

}


/* =========================================================
   休暇メニュー
========================================================= */

function showLeaveMenu(
  cell,
  staffName,
  date
) {

  closeShiftMenu();


  selectedCell = {

    cell,
    staffName,
    date

  };


  leaveMenuOpen = true;


  const menu =
    $("leaveMenu");

  const buttons =
    $("leaveMenuButtons");

  const title =
    $("leaveMenuTitle");


  if (
    !menu ||
    !buttons
  ) {

    return;

  }


  if (title) {

    title.textContent =
      `${formatDateJapanese(
        date
      )}　休暇`;

  }


  buttons.innerHTML =
    "";


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
          "leave-option";


        button.textContent =
          leave.name;


        if (leave.color) {

          button.style.background =
            leave.color;

        }


        button.addEventListener(
          "click",
          async event => {

            event.stopPropagation();


            await setLeave(
              staffName,
              date,
              leave.name
            );


            closeLeaveMenu();

          }
        );


        buttons.appendChild(
          button
        );

      }
    );


  const clearButton =
    document.createElement(
      "button"
    );


  clearButton.type =
    "button";


  clearButton.textContent =
    "休暇をクリア";


  clearButton.className =
    "menu-wide menu-danger";


  clearButton.addEventListener(
    "click",
    async event => {

      event.stopPropagation();


      await clearLeaveOnly(
        staffName,
        date
      );


      closeLeaveMenu();

    }
  );


  buttons.appendChild(
    clearButton
  );


  const backButton =
    document.createElement(
      "button"
    );


  backButton.type =
    "button";


  backButton.textContent =
    "戻る";


  backButton.className =
    "menu-wide";


  backButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();


      closeLeaveMenu();


      showShiftMenu(
        cell,
        staffName,
        date
      );

    }
  );


  buttons.appendChild(
    backButton
  );


  positionMenuFromCell(
    menu,
    cell
  );

}


/* =========================================================
   ★ メニュー位置
   右 → 左 → 画面内
========================================================= */

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


  menu.style.position =
    "fixed";


  menu.style.display =
    "block";


  menu.classList.add(
    "show"
  );


  /*
    一度画面外へ
  */

  menu.style.left =
    "-9999px";

  menu.style.top =
    "-9999px";


  const rect =
    cell.getBoundingClientRect();


  const screenWidth =
    window.innerWidth;


  const screenHeight =
    window.innerHeight;


  const margin = 10;

  const gap = 8;


  const menuRect =
    menu.getBoundingClientRect();


  const menuWidth =
    menuRect.width;


  const menuHeight =
    menuRect.height;


  /*
    =====================================
    ① 右側
    =====================================
  */

  let left =
    rect.right + gap;


  /*
    =====================================
    ② 右に入らなければ左側
    =====================================
  */

  if (
    left + menuWidth >
    screenWidth - margin
  ) {

    left =
      rect.left -
      menuWidth -
      gap;

  }


  /*
    =====================================
    ③ 左にも入らない
    =====================================
  */

  if (
    left < margin
  ) {

    /*
      画面中央
    */

    left =
      Math.max(
        margin,
        (
          screenWidth -
          menuWidth
        ) / 2
      );

  }


  /*
    =====================================
    縦位置
    =====================================
  */

  let top =
    rect.top;


  /*
    下にはみ出す
  */

  if (
    top + menuHeight >
    screenHeight - margin
  ) {

    /*
      上に置く
    */

    const above =
      rect.bottom -
      menuHeight;


    if (
      above >= margin
    ) {

      top =
        above;

    } else {

      /*
        それでも無理なら
        画面下に合わせる
      */

      top =
        screenHeight -
        menuHeight -
        margin;

    }

  }


  /*
    上にはみ出さない
  */

  if (
    top < margin
  ) {

    top =
      margin;

  }


  /*
    =====================================
    メニュー高さ
    =====================================
  */

  const availableHeight =
    screenHeight -
    margin * 2;


  menu.style.maxHeight =
    Math.max(
      180,
      availableHeight
    ) + "px";


  menu.style.overflowY =
    "auto";


  menu.style.overflowX =
    "hidden";


  menu.style.webkitOverflowScrolling =
    "touch";


  /*
    =====================================
    最終位置
    =====================================
  */

  menu.style.left =
    `${Math.round(left)}px`;


  menu.style.top =
    `${Math.round(top)}px`;

}


/* =========================================================
   メニュー閉じる
========================================================= */

function closeShiftMenu() {

  const menu =
    $("shiftMenu");


  if (!menu)
    return;


  menu.classList.remove(
    "show"
  );


  menu.style.display =
    "none";


  menu.style.position =
    "fixed";


  menu.style.left =
    "-9999px";


  menu.style.top =
    "-9999px";


  menu.style.maxHeight =
    "";


  menu.style.overflowY =
    "";

}


function closeLeaveMenu() {

  const menu =
    $("leaveMenu");


  if (!menu)
    return;


  menu.classList.remove(
    "show"
  );


  menu.style.display =
    "none";


  menu.style.position =
    "fixed";


  menu.style.left =
    "-9999px";


  menu.style.top =
    "-9999px";


  menu.style.maxHeight =
    "";


  menu.style.overflowY =
    "";


  leaveMenuOpen =
    false;

}


function forceCloseMenus() {

  closeShiftMenu();

  closeLeaveMenu();

}


/* =========================================================
   画面外クリック
========================================================= */

function handleDocumentClick(
  event
) {

  const shiftMenu =
    $("shiftMenu");

  const leaveMenu =
    $("leaveMenu");


  if (
    shiftMenu &&
    shiftMenu.classList.contains(
      "show"
    ) &&
    !shiftMenu.contains(
      event.target
    ) &&
    !event.target.closest(
      ".schedule-cell"
    )
  ) {

    closeShiftMenu();

  }


  if (
    leaveMenu &&
    leaveMenu.classList.contains(
      "show"
    ) &&
    !leaveMenu.contains(
      event.target
    ) &&
    !event.target.closest(
      ".schedule-cell"
    )
  ) {

    closeLeaveMenu();

  }

}


/* =========================================================
   勤務登録
========================================================= */

async function setWorkShift(
  staffName,
  date,
  shiftName
) {

  if (!supabaseClient)
    return;


  try {

    const existingLeave =
      appData
        .leaves?.[
          staffName
        ]?.[
          date
        ] || null;


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


    const {
      error
    } =
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
            existingLeave

        });


    if (error)
      throw error;


    if (
      !appData.shifts[
        staffName
      ]
    ) {

      appData.shifts[
        staffName
      ] = {};

    }


    appData.shifts[
      staffName
    ][date] =
      shiftName;


    saveLocal();

    renderSchedule();

    setStatus(
      "勤務を登録しました"
    );


  } catch (error) {

    console.error(
      "setWorkShift",
      error
    );

    alert(
      "勤務登録に失敗しました。"
    );

  }

}


/* =========================================================
   休暇登録
========================================================= */

async function setLeave(
  staffName,
  date,
  leaveName
) {

  if (!supabaseClient)
    return;


  try {

    const existingShift =
      appData
        .shifts?.[
          staffName
        ]?.[
          date
        ] || null;


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


    const {
      error
    } =
      await supabaseClient
        .from("work_shifts")
        .insert({

          staff_name:
            staffName,

          work_date:
            date,

          shift_name:
            existingShift,

          leave_type:
            leaveName

        });


    if (error)
      throw error;


    if (
      !appData.leaves[
        staffName
      ]
    ) {

      appData.leaves[
        staffName
      ] = {};

    }


    appData.leaves[
      staffName
    ][date] =
      leaveName;


    saveLocal();

    renderSchedule();


    setStatus(
      "休暇を登録しました"
    );


  } catch (error) {

    console.error(
      "setLeave",
      error
    );

    alert(
      "休暇を登録できませんでした。"
    );

  }

}


/* =========================================================
   休暇クリア
========================================================= */

async function clearLeaveOnly(
  staffName,
  date
) {

  if (!supabaseClient)
    return;


  try {

    const existingShift =
      appData
        .shifts?.[
          staffName
        ]?.[
          date
        ] || null;


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


    if (existingShift) {

      const {
        error
      } =
        await supabaseClient
          .from("work_shifts")
          .insert({

            staff_name:
              staffName,

            work_date:
              date,

            shift_name:
              existingShift,

            leave_type:
              null

          });


      if (error)
        throw error;

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

    renderSchedule();


  } catch (error) {

    console.error(
      "clearLeaveOnly",
      error
    );

    alert(
      "休暇の削除に失敗しました。"
    );

  }

}


/* =========================================================
   勤務完全クリア
========================================================= */

async function clearWorkShift(
  staffName,
  date
) {

  if (!supabaseClient)
    return;


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
          date
        );


    if (error)
      throw error;


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

    renderSchedule();


  } catch (error) {

    console.error(
      "clearWorkShift",
      error
    );

    alert(
      "勤務の削除に失敗しました。"
    );

  }

}


/* =========================================================
   職員
========================================================= */

async function saveStaff() {

  const input =
    $("staffNameInput");


  const name =
    input?.value.trim();


  if (!name) {

    alert(
      "職員名を入力してください。"
    );

    return;

  }


  try {

    if (
      editingStaffIndex >= 0
    ) {

      const staff =
        appData.staff[
          editingStaffIndex
        ];


      const oldName =
        staff.name;


      const {
        error
      } =
        await supabaseClient
          .from("staff")
          .update({
            name
          })
          .eq(
            "id",
            staff.id
          );


      if (error)
        throw error;


      if (
        oldName !== name
      ) {

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


        appData.shifts[name] =
          appData.shifts[
            oldName
          ] || {};


        appData.leaves[name] =
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


      appData.staff[
        editingStaffIndex
      ].name =
        name;


    } else {

      const {
        data,
        error
      } =
        await supabaseClient
          .from("staff")
          .insert({

            name,

            sort_order:
              appData.staff.length + 1

          })
          .select()
          .single();


      if (error)
        throw error;


      appData.staff.push(
        data
      );

    }


    resetStaffForm();

    saveLocal();

    renderAll();


  } catch (error) {

    console.error(
      "saveStaff",
      error
    );

    alert(
      "職員の保存に失敗しました。"
    );

  }

}


function editStaff(
  index
) {

  const staff =
    appData.staff[index];


  if (!staff)
    return;


  editingStaffIndex =
    index;


  $("staffNameInput").value =
    staff.name;


  $("addStaffButton").textContent =
    "職員を更新";

}


function resetStaffForm() {

  editingStaffIndex =
    -1;


  if ($("staffNameInput")) {

    $("staffNameInput").value =
      "";

  }


  if ($("addStaffButton")) {

    $("addStaffButton").textContent =
      "職員を追加";

  }

}


async function moveStaff(
  index,
  direction
) {

  const target =
    index + direction;


  if (
    target < 0 ||
    target >= appData.staff.length
  ) {

    return;

  }


  const a =
    appData.staff[index];

  const b =
    appData.staff[target];


  [
    appData.staff[index],
    appData.staff[target]
  ] = [

    appData.staff[target],
    appData.staff[index]

  ];


  try {

    await supabaseClient
      .from("staff")
      .update({
        sort_order:
          index
      })
      .eq(
        "id",
        b.id
      );


    await supabaseClient
      .from("staff")
      .update({
        sort_order:
          target
      })
      .eq(
        "id",
        a.id
      );


    saveLocal();

    renderStaffList();

    renderSchedule();


  } catch (error) {

    console.error(
      "moveStaff",
      error
    );

  }

}


async function deleteStaff(
  index
) {

  const staff =
    appData.staff[index];


  if (!staff)
    return;


  if (
    !confirm(
      `${staff.name} を削除しますか？`
    )
  ) {

    return;

  }


  try {

    await supabaseClient
      .from("work_shifts")
      .delete()
      .eq(
        "staff_name",
        staff.name
      );


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


    if (error)
      throw error;


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


    saveLocal();

    renderAll();


  } catch (error) {

    console.error(
      "deleteStaff",
      error
    );

    alert(
      "職員の削除に失敗しました。"
    );

  }

}


function renderStaffList() {

  const list =
    $("staffList");


  const count =
    $("staffCount");


  if (!list)
    return;


  if (count) {

    count.textContent =
      `職員数：${appData.staff.length}人`;

  }


  list.innerHTML =
    "";


  appData.staff
    .forEach(
      (staff, index) => {

        const item =
          document.createElement(
            "div"
          );


        item.className =
          "list-item";


        item.innerHTML = `

          <div class="sort-buttons">

            <button
              type="button"
              data-up
            >
              ▲
            </button>

            <button
              type="button"
              data-down
            >
              ▼
            </button>

          </div>


          <div class="list-item-main">

            <div class="list-item-title">

              ${escapeHtml(
                staff.name
              )}

            </div>

          </div>


          <div class="list-actions">

            <button
              type="button"
              data-edit
            >
              編集
            </button>

            <button
              type="button"
              class="danger"
              data-delete
            >
              削除
            </button>

          </div>

        `;


        item
          .querySelector(
            "[data-up]"
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
            "[data-down]"
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
            "[data-edit]"
          )
          ?.addEventListener(
            "click",
            () =>
              editStaff(
                index
              )
          );


        item
          .querySelector(
            "[data-delete]"
          )
          ?.addEventListener(
            "click",
            () =>
              deleteStaff(
                index
              )
          );


        list.appendChild(
          item
        );

      }
    );

}


/* =========================================================
   勤務形態
========================================================= */

async function saveShiftType() {

  const name =
    $("shiftNameInput")
      ?.value.trim();


  const start =
    $("shiftStartInput")
      ?.value || null;


  const end =
    $("shiftEndInput")
      ?.value || null;


  const breakTime =
    $("shiftBreakInput")
      ?.value.trim() || null;


  if (!name) {

    alert(
      "勤務形態名を入力してください。"
    );

    return;

  }


  try {

    if (
      editingShiftIndex >= 0
    ) {

      const shift =
        appData.shiftTypes[
          editingShiftIndex
        ];


      const oldName =
        shift.name;


      const {
        error
      } =
        await supabaseClient
          .from("shift_types")
          .update({

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


      if (error)
        throw error;


      if (
        oldName !== name
      ) {

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


        Object.keys(
          appData.shifts
        ).forEach(
          staffName => {

            Object.keys(
              appData.shifts[
                staffName
              ] || {}
            ).forEach(
              date => {

                if (
                  appData.shifts[
                    staffName
                  ][date] ===
                  oldName
                ) {

                  appData.shifts[
                    staffName
                  ][date] =
                    name;

                }

              }
            );

          }
        );

      }


      appData.shiftTypes[
        editingShiftIndex
      ] = {

        ...shift,

        name,

        start_time:
          start,

        end_time:
          end,

        break_time:
          breakTime

      };


    } else {

      const {
        data,
        error
      } =
        await supabaseClient
          .from("shift_types")
          .insert({

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


      if (error)
        throw error;


      appData.shiftTypes.push(
        data
      );

    }


    resetShiftForm();

    saveLocal();

    renderAll();


  } catch (error) {

    console.error(
      "saveShiftType",
      error
    );

    alert(
      "勤務形態の保存に失敗しました。"
    );

  }

}


function editShift(
  index
) {

  const shift =
    appData.shiftTypes[index];


  if (!shift)
    return;


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

}


function resetShiftForm() {

  editingShiftIndex =
    -1;


  if ($("shiftNameInput"))
    $("shiftNameInput").value = "";

  if ($("shiftStartInput"))
    $("shiftStartInput").value = "";

  if ($("shiftEndInput"))
    $("shiftEndInput").value = "";

  if ($("shiftBreakInput"))
    $("shiftBreakInput").value = "";


  if ($("addShiftButton"))
    $("addShiftButton").textContent =
      "勤務形態を追加";

}


async function deleteShiftType(
  index
) {

  const shift =
    appData.shiftTypes[index];


  if (!shift)
    return;


  if (
    !confirm(
      `${shift.name} を削除しますか？`
    )
  ) {

    return;

  }


  try {

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


    if (error)
      throw error;


    appData.shiftTypes.splice(
      index,
      1
    );


    saveLocal();

    renderAll();


  } catch (error) {

    console.error(
      "deleteShiftType",
      error
    );

  }

}


function renderShiftList() {

  const list =
    $("shiftList");


  if (!list)
    return;


  list.innerHTML =
    "";


  appData.shiftTypes
    .forEach(
      (shift, index) => {

        const item =
          document.createElement(
            "div"
          );


        item.className =
          "list-item";


        let sub = "";


        if (
          shift.start_time ||
          shift.end_time
        ) {

          sub =
            `${shift.start_time || "--:--"} ～ ${shift.end_time || "--:--"}`;

        }


        if (shift.break_time) {

          sub +=
            `　休憩 ${shift.break_time}`;

        }


        item.innerHTML = `

          <div class="list-item-main">

            <div class="list-item-title">

              ${escapeHtml(
                shift.name
              )}

            </div>

            <div class="list-item-sub">

              ${escapeHtml(
                sub
              )}

            </div>

          </div>


          <div class="list-actions">

            <button
              type="button"
              data-edit
            >
              編集
            </button>

            <button
              type="button"
              class="danger"
              data-delete
            >
              削除
            </button>

          </div>

        `;


        item
          .querySelector(
            "[data-edit]"
          )
          ?.addEventListener(
            "click",
            () =>
              editShift(
                index
              )
          );


        item
          .querySelector(
            "[data-delete]"
          )
          ?.addEventListener(
            "click",
            () =>
              deleteShiftType(
                index
              )
          );


        list.appendChild(
          item
        );

      }
    );

}


/* =========================================================
   休暇種類
========================================================= */

async function saveLeaveType() {

  const name =
    $("leaveTypeNameInput")
      ?.value.trim();


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


  try {

    if (
      editingLeaveTypeId
    ) {

      const old =
        appData.leaveTypes.find(
          item =>
            item.id ===
            editingLeaveTypeId
        );


      const oldName =
        old?.name;


      const {
        error
      } =
        await supabaseClient
          .from("leave_types")
          .update({

            name,

            color

          })
          .eq(
            "id",
            editingLeaveTypeId
          );


      if (error)
        throw error;


      if (
        oldName &&
        oldName !== name
      ) {

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


        Object.keys(
          appData.leaves
        ).forEach(
          staffName => {

            Object.keys(
              appData.leaves[
                staffName
              ] || {}
            ).forEach(
              date => {

                if (
                  appData.leaves[
                    staffName
                  ][date] ===
                  oldName
                ) {

                  appData.leaves[
                    staffName
                  ][date] =
                    name;

                }

              }
            );

          }
        );

      }


      const index =
        appData.leaveTypes.findIndex(
          item =>
            item.id ===
            editingLeaveTypeId
        );


      if (index >= 0) {

        appData.leaveTypes[
          index
        ] = {

          ...appData.leaveTypes[
            index
          ],

          name,

          color

        };

      }


    } else {

      const {
        data,
        error
      } =
        await supabaseClient
          .from("leave_types")
          .insert({

            name,

            color

          })
          .select()
          .single();


      if (error)
        throw error;


      appData.leaveTypes.push(
        data
      );

    }


    resetLeaveTypeForm();

    saveLocal();

    renderAll();


  } catch (error) {

    console.error(
      "saveLeaveType",
      error
    );

    alert(
      "休暇種類の保存に失敗しました。"
    );

  }

}


function editLeaveType(
  id
) {

  const leave =
    appData.leaveTypes.find(
      item =>
        item.id === id
    );


  if (!leave)
    return;


  editingLeaveTypeId =
    id;


  $("leaveTypeNameInput").value =
    leave.name || "";


  $("leaveTypeColorInput").value =
    leave.color ||
    "#d9f2df";


  $("addLeaveTypeButton").textContent =
    "休暇種類を更新";

}


function resetLeaveTypeForm() {

  editingLeaveTypeId =
    null;


  if ($("leaveTypeNameInput"))
    $("leaveTypeNameInput").value = "";


  if ($("leaveTypeColorInput"))
    $("leaveTypeColorInput").value =
      "#d9f2df";


  if ($("addLeaveTypeButton"))
    $("addLeaveTypeButton").textContent =
      "休暇種類を追加";

}


async function deleteLeaveType(
  id
) {

  const leave =
    appData.leaveTypes.find(
      item =>
        item.id === id
    );


  if (!leave)
    return;


  if (
    !confirm(
      `${leave.name} を削除しますか？`
    )
  ) {

    return;

  }


  try {

    const {
      error
    } =
      await supabaseClient
        .from("leave_types")
        .delete()
        .eq(
          "id",
          id
        );


    if (error)
      throw error;


    appData.leaveTypes =
      appData.leaveTypes.filter(
        item =>
          item.id !== id
      );


    saveLocal();

    renderAll();


  } catch (error) {

    console.error(
      "deleteLeaveType",
      error
    );

  }

}


function renderLeaveTypeList() {

  const list =
    $("leaveTypeList");


  if (!list)
    return;


  list.innerHTML =
    "";


  appData.leaveTypes
    .forEach(
      leave => {

        const item =
          document.createElement(
            "div"
          );


        item.className =
          "list-item";


        item.innerHTML = `

          <div
            style="
              width:24px;
              height:24px;
              border-radius:6px;
              background:${escapeHtml(
                leave.color ||
                "#ddd"
              )};
              border:1px solid #ccc;
              flex:none;
            "
          ></div>


          <div class="list-item-main">

            <div class="list-item-title">

              ${escapeHtml(
                leave.name
              )}

            </div>

          </div>


          <div class="list-actions">

            <button
              type="button"
              data-edit
            >
              編集
            </button>

            <button
              type="button"
              class="danger"
              data-delete
            >
              削除
            </button>

          </div>

        `;


        item
          .querySelector(
            "[data-edit]"
          )
          ?.addEventListener(
            "click",
            () =>
              editLeaveType(
                leave.id
              )
          );


        item
          .querySelector(
            "[data-delete]"
          )
          ?.addEventListener(
            "click",
            () =>
              deleteLeaveType(
                leave.id
              )
          );


        list.appendChild(
          item
        );

      }
    );

}


function getLeaveType(
  name
) {

  return appData
    .leaveTypes
    .find(
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
      ?.value.trim();


  const start =
    $("companyHolidayStart")
      ?.value;


  const end =
    $("companyHolidayEnd")
      ?.value ||
    start;


  if (
    !name ||
    !start ||
    !end
  ) {

    alert(
      "休業日名・開始日・終了日を入力してください。"
    );

    return;

  }


  try {

    if (
      editingHolidayId
    ) {

      const {
        error
      } =
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


      if (error)
        throw error;


      const index =
        appData
          .companyHolidays
          .findIndex(
            item =>
              item.id ===
              editingHolidayId
          );


      if (index >= 0) {

        appData.companyHolidays[
          index
        ] = {

          ...appData
            .companyHolidays[
              index
            ],

          name,

          start_date:
            start,

          end_date:
            end

        };

      }


    } else {

      const {
        data,
        error
      } =
        await supabaseClient
          .from("company_holidays")
          .insert({

            name,

            start_date:
              start,

            end_date:
              end

          })
          .select()
          .single();


      if (error)
        throw error;


      appData.companyHolidays.push(
        data
      );

    }


    resetHolidayForm();

    saveLocal();

    renderAll();


  } catch (error) {

    console.error(
      "saveCompanyHoliday",
      error
    );

    alert(
      "休業日の保存に失敗しました。"
    );

  }

}


function editCompanyHoliday(
  id
) {

  const holiday =
    appData.companyHolidays.find(
      item =>
        item.id === id
    );


  if (!holiday)
    return;


  editingHolidayId =
    id;


  $("companyHolidayName").value =
    holiday.name || "";


  $("companyHolidayStart").value =
    holiday.start_date || "";


  $("companyHolidayEnd").value =
    holiday.end_date || "";


  $("addCompanyHolidayButton").textContent =
    "休業日を更新";

}


function resetHolidayForm() {

  editingHolidayId =
    null;


  if ($("companyHolidayName"))
    $("companyHolidayName").value = "";


  if ($("companyHolidayStart"))
    $("companyHolidayStart").value = "";


  if ($("companyHolidayEnd"))
    $("companyHolidayEnd").value = "";


  if ($("addCompanyHolidayButton"))
    $("addCompanyHolidayButton").textContent =
      "休業日を追加";

}


async function deleteCompanyHoliday(
  id
) {

  const holiday =
    appData.companyHolidays.find(
      item =>
        item.id === id
    );


  if (!holiday)
    return;


  if (
    !confirm(
      `${holiday.name} を削除しますか？`
    )
  ) {

    return;

  }


  try {

    const {
      error
    } =
      await supabaseClient
        .from("company_holidays")
        .delete()
        .eq(
          "id",
          id
        );


    if (error)
      throw error;


    appData.companyHolidays =
      appData.companyHolidays.filter(
        item =>
          item.id !== id
      );


    saveLocal();

    renderAll();


  } catch (error) {

    console.error(
      "deleteCompanyHoliday",
      error
    );

  }

}


function renderCompanyHolidayList() {

  const list =
    $("companyHolidayList");


  if (!list)
    return;


  list.innerHTML =
    "";


  appData.companyHolidays
    .forEach(
      holiday => {

        const item =
          document.createElement(
            "div"
          );


        item.className =
          "list-item";


        item.innerHTML = `

          <div class="list-item-main">

            <div class="list-item-title">

              ${escapeHtml(
                holiday.name
              )}

            </div>


            <div class="list-item-sub">

              ${escapeHtml(
                holiday.start_date
              )}

              ～

              ${escapeHtml(
                holiday.end_date
              )}

            </div>

          </div>


          <div class="list-actions">

            <button
              type="button"
              data-edit
            >
              編集
            </button>

            <button
              type="button"
              class="danger"
              data-delete
            >
              削除
            </button>

          </div>

        `;


        item
          .querySelector(
            "[data-edit]"
          )
          ?.addEventListener(
            "click",
            () =>
              editCompanyHoliday(
                holiday.id
              )
          );


        item
          .querySelector(
            "[data-delete]"
          )
          ?.addEventListener(
            "click",
            () =>
              deleteCompanyHoliday(
                holiday.id
              )
          );


        list.appendChild(
          item
        );

      }
    );

}


/* =========================================================
   明時間
========================================================= */

function renderAkeTime() {

  const start =
    $("akeStartInput");

  const end =
    $("akeEndInput");


  if (start) {

    start.value =
      appData
        .akeTime?.start ||
      "05:30";

  }


  if (end) {

    end.value =
      appData
        .akeTime?.end ||
      "11:15";

  }

}


async function upsertAppSetting(
  key,
  value
) {

  const {
    error
  } =
    await supabaseClient
      .from("app_settings")
      .upsert(
        {
          key,
          value
        },
        {
          onConflict:
            "key"
        }
      );


  if (error)
    throw error;

}


async function saveAkeTime() {

  const start =
    $("akeStartInput").value;

  const end =
    $("akeEndInput").value;


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


  } catch (error) {

    console.error(
      "saveAkeTime",
      error
    );

    alert(
      "「明」の時間の保存に失敗しました。"
    );

  }

}


/* =========================================================
   月削除
========================================================= */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth() + 1;


  const start =
    dateKey(
      year,
      month,
      1
    );


  const end =
    dateKey(
      year,
      month,
      getMonthDays()
    );


  if (
    !confirm(
      `${year}年${month}月の勤務をすべて削除しますか？`
    )
  ) {

    return;

  }


  try {

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


    if (error)
      throw error;


    Object.keys(
      appData.shifts
    ).forEach(
      staff => {

        Object.keys(
          appData.shifts[
            staff
          ] || {}
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
          ] || {}
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


    saveLocal();

    renderSchedule();


  } catch (error) {

    console.error(
      "deleteCurrentMonth",
      error
    );

  }

}


/* =========================================================
   年度削除
========================================================= */

async function deleteFiscalYear() {

  const selectedYear =
    currentDate.getFullYear();


  const fiscalStart =
    selectedYear +
    "-04-01";


  const fiscalEnd =
    (selectedYear + 1) +
    "-03-31";


  if (
    !confirm(
      `${selectedYear}年度の勤務をすべて削除しますか？`
    )
  ) {

    return;

  }


  try {

    const {
      error
    } =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .gte(
          "work_date",
          fiscalStart
        )
        .lte(
          "work_date",
          fiscalEnd
        );


    if (error)
      throw error;


    Object.keys(
      appData.shifts
    ).forEach(
      staff => {

        Object.keys(
          appData.shifts[
            staff
          ] || {}
        ).forEach(
          date => {

            if (
              date >= fiscalStart &&
              date <= fiscalEnd
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
          ] || {}
        ).forEach(
          date => {

            if (
              date >= fiscalStart &&
              date <= fiscalEnd
            ) {

              delete appData.leaves[
                staff
              ][date];

            }

          }
        );

      }
    );


    saveLocal();

    renderSchedule();


  } catch (error) {

    console.error(
      "deleteFiscalYear",
      error
    );

  }

}


/* =========================================================
   カレンダー
========================================================= */

function openCalendarModal(
  staffName
) {

  const modal =
    $("calendarConfirm");


  if (!modal)
    return;


  modal.dataset.staff =
    staffName;


  selectedCalendarStaff =
    staffName;


  const title =
    $("calendarConfirmTitle");


  const text =
    $("calendarConfirmText");


  if (title) {

    title.textContent =
      `${staffName}のカレンダー`;

  }


  if (text) {

    text.textContent =
      `${staffName}の勤務表をカレンダーに登録しますか？`;

  }


  modal.style.display =
    "flex";


  modal.classList.add(
    "show"
  );

}


function closeCalendarModal() {

  const modal =
    $("calendarConfirm");


  if (!modal)
    return;


  modal.classList.remove(
    "show"
  );


  modal.style.display =
    "none";


  modal.dataset.staff =
    "";


  selectedCalendarStaff =
    null;

}


/* =========================================================
   webcal
========================================================= */

function subscribeStaffCalendar() {

  const modal =
    $("calendarConfirm");


  if (!modal)
    return;


  const staffName =
    modal.dataset.staff;


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
      "この職員のカレンダー情報がありません。"
    );

    closeCalendarModal();

    return;

  }


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
   Realtime
========================================================= */

function setupRealtime() {

  if (!supabaseClient)
    return;


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
      "Realtime",
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
      () => {

        /*
          更新時にメニューを絶対に残さない
        */

        forceCloseMenus();

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
      () => {

        if (
          document.visibilityState ===
          "visible"
        ) {

          forceCloseMenus();

          loadAllFromSupabase(
            true
          );

        }

      },
      10000
    );

}


/* =========================================================
   iPhone復帰
========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
      "visible"
    ) {

      forceCloseMenus();

      closeCalendarModal();

      loadAllFromSupabase(
        true
      );

    }

  }
);
