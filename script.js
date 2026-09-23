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
   初期データ
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


let editingStaffIndex =
  -1;

let editingShiftIndex =
  -1;

let editingHolidayId =
  null;

let editingLeaveTypeId =
  null;


let selectedCell =
  null;

let selectedCalendarStaff =
  null;


let publicHolidays =
  {};


let supabaseClient =
  null;

let realtimeChannel =
  null;

let realtimeReloadTimer =
  null;

let autoSyncTimer =
  null;


let leaveMenuOpen =
  false;

let cloudOperationBusy =
  false;


/* =========================================================
   起動
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      /*
        起動直後に全メニューを強制的に閉じる
      */

      closeCalendarModal();

      closeShiftMenu();

      closeLeaveMenu();


      /*
        CSS側で表示状態になっていても
        強制的に非表示にする
      */

      const shiftMenu =
        $("shiftMenu");

      if (shiftMenu) {

        shiftMenu.classList.remove(
          "show"
        );

        shiftMenu.style.display =
          "none";

        shiftMenu.style.left =
          "-9999px";

        shiftMenu.style.top =
          "-9999px";

      }


      const leaveMenu =
        $("leaveMenu");

      if (leaveMenu) {

        leaveMenu.classList.remove(
          "show"
        );

        leaveMenu.style.display =
          "none";

        leaveMenu.style.left =
          "-9999px";

        leaveMenu.style.top =
          "-9999px";

      }


      initSupabase();


      loadLocal();


      bindEvents();


      renderAll();


      await loadAllFromSupabase();


      startAutoSync();


      showPage(
        "schedule"
      );


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
   Supabaseから全データ取得
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


  cloudOperationBusy =
    true;


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


    const shifts =
      {};


    const leaves =
      {};


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
              !shifts[
                staffName
              ]
            ) {

              shifts[
                staffName
              ] = {};

            }


            shifts[
              staffName
            ][date] =
              row.shift_name;

          }


          if (row.leave_type) {

            if (
              !leaves[
                staffName
              ]
            ) {

              leaves[
                staffName
              ] = {};

            }


            leaves[
              staffName
            ][date] =
              row.leave_type;

          }

        }
      );


    const settings =
      settingResult.data || [];


    let akeStart =
      "05:30";


    let akeEnd =
      "11:15";


    settings.forEach(
      row => {

        if (
          row.key ===
          "ake_start"
        ) {

          akeStart =
            row.value ||
            akeStart;

        }


        if (
          row.key ===
          "ake_end"
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

    cloudOperationBusy =
      false;

  }

}


/* =========================================================
   ローカル保存
========================================================= */

function saveLocal() {

  try {

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(
        appData
      )
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
      JSON.parse(
        saved
      );


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

  const el =
    $("appStatus");


  if (!el)
    return;


  el.textContent =
    message;

}


/* =========================================================
   イベント
========================================================= */

function bindEvents() {

  /*
    ナビゲーション
  */

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


  /*
    前月
  */

  $("prevMonth")
    ?.addEventListener(
      "click",
      () => {

        closeAllMenus();


        currentDate.setMonth(
          currentDate.getMonth() - 1
        );


        renderSchedule();

      }
    );


  /*
    次月
  */

  $("nextMonth")
    ?.addEventListener(
      "click",
      () => {

        closeAllMenus();


        currentDate.setMonth(
          currentDate.getMonth() + 1
        );


        renderSchedule();

      }
    );


  /*
    職員
  */

  $("addStaffButton")
    ?.addEventListener(
      "click",
      saveStaff
    );


  /*
    勤務形態
  */

  $("addShiftButton")
    ?.addEventListener(
      "click",
      saveShiftType
    );


  /*
    休業日
  */

  $("addCompanyHolidayButton")
    ?.addEventListener(
      "click",
      saveCompanyHoliday
    );


  /*
    休暇種類
  */

  $("addLeaveTypeButton")
    ?.addEventListener(
      "click",
      saveLeaveType
    );


  /*
    明の時間
  */

  $("saveAkeTimeButton")
    ?.addEventListener(
      "click",
      saveAkeTime
    );


  /*
    今月削除
  */

  $("deleteMonthButton")
    ?.addEventListener(
      "click",
      deleteCurrentMonth
    );


  /*
    年度削除
  */

  $("deleteFiscalYearButton")
    ?.addEventListener(
      "click",
      deleteFiscalYear
    );


  /*
    カレンダーキャンセル
  */

  $("calendarCancelButton")
    ?.addEventListener(
      "click",
      closeCalendarModal
    );


  /*
    カレンダー登録
  */

  $("calendarOKButton")
    ?.addEventListener(
      "click",
      subscribeStaffCalendar
    );


  /*
    休業日開始日
  */

  $("companyHolidayStart")
    ?.addEventListener(
      "change",
      () => {

        const start =
          $("companyHolidayStart")
            ?.value;


        const end =
          $("companyHolidayEnd");


        if (
          start &&
          end &&
          !end.value
        ) {

          end.value =
            start;

        }

      }
    );


  /*
    画面外クリック
  */

  document.addEventListener(
    "click",
    handleDocumentClick
  );


  /*
    リサイズ
  */

  window.addEventListener(
    "resize",
    () => {

      closeAllMenus();

    }
  );


  /*
    スクロール
  */

  window.addEventListener(
    "scroll",
    () => {

      closeAllMenus();

    },
    true
  );


  /*
    Realtime
  */

  setupRealtime();

}


/* =========================================================
   全メニューを閉じる
========================================================= */

function closeAllMenus() {

  closeShiftMenu();

  closeLeaveMenu();

}


/* =========================================================
   ページ切り替え
========================================================= */

function showPage(
  pageName
) {

  closeAllMenus();


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
    pageName ===
    "schedule"
  ) {

    renderSchedule();

  }


  if (
    pageName ===
    "staff"
  ) {

    renderStaffList();

  }


  if (
    pageName ===
    "shift"
  ) {

    renderShiftList();

    renderAkeTime();

  }


  if (
    pageName ===
    "holiday"
  ) {

    renderCompanyHolidayList();

  }


  if (
    pageName ===
    "leaveType"
  ) {

    renderLeaveTypeList();

  }

}


/* =========================================================
   基本ヘルパー
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
  )
    .padStart(
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

  const year =
    currentDate.getFullYear();


  const month =
    currentDate.getMonth() + 1;


  return new Date(
    year,
    month,
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
      祝日取得だけで
      メニューを出さない
    */

    closeAllMenus();


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
    publicHolidays[
      date
    ]
  );

}


function isCompanyHoliday(
  date
) {

  return appData
    .companyHolidays
    .some(
      holiday => {

        return (

          date >=
            holiday.start_date &&

          date <=
            holiday.end_date

        );

      }
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


  const text =
    String(
      shiftName
    );


  return (

    text.includes("宿") ||

    text.includes("夜")

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
   全体描画
========================================================= */

function renderAll() {

  closeAllMenus();

  closeCalendarModal();


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

  /*
    再描画時にメニューを必ず閉じる
  */

  closeShiftMenu();

  closeLeaveMenu();


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


  /*
    月表示
  */

  if (monthLabel) {

    monthLabel.textContent =
      year +
      "年" +
      month +
      "月";

  }


  /*
    ヘッダー
  */

  let headerHtml =
    `<th class="staff-header">職員</th>`;


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

        <span
          class="day-number"
        >
          ${day}
        </span>

        <span
          class="weekday"
        >
          ${weekday}
        </span>

      </th>

    `;

  }


  header.innerHTML =
    headerHtml;


  /*
    本体
  */

  let bodyHtml =
    "";


  appData.staff.forEach(
    staff => {

      const name =
        staff.name;


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
              ` style="background:${escapeHtml(
                leaveType.color
              )}"`;

          }


          cls +=
            " leave-cell";

        }


        let value =
          "";


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

            <span
              class="ake-cell"
            >

              <span
                class="ake-label"
              >
                明
              </span>

              <span
                class="ake-time"
              >
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
    勤務セル
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
    祝日
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
   勤務選択メニュー
========================================================= */

function showShiftMenu(
  cell,
  staffName,
  date
) {

  /*
    休暇メニューを閉じる
  */

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
      formatDateJapanese(date) +
      "　" +
      staffName;

  }


  buttons.innerHTML =
    "";


  /*
    勤務形態
  */

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
          event => {

            event.stopPropagation();


            setWorkShift(
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


  /*
    勤務クリア
  */

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
    event => {

      event.stopPropagation();


      clearWorkShift(
        staffName,
        date
      );


      closeShiftMenu();

    }
  );


  buttons.appendChild(
    clearButton
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
    ★ 表示位置を計算
  */

  positionMenuFromCell(
    menu,
    cell
  );

}


/* =========================================================
   休暇選択メニュー
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


  leaveMenuOpen =
    true;


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
      formatDateJapanese(date) +
      "　休暇";

  }


  buttons.innerHTML =
    "";


  /*
    休暇種類
  */

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
          event => {

            event.stopPropagation();


            setLeave(
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


  /*
    休暇クリア
  */

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
    event => {

      event.stopPropagation();


      clearLeaveOnly(
        staffName,
        date
      );


      closeLeaveMenu();

    }
  );


  buttons.appendChild(
    clearButton
  );


  /*
    戻る
  */

  const cancelButton =
    document.createElement(
      "button"
    );


  cancelButton.type =
    "button";


  cancelButton.textContent =
    "戻る";


  cancelButton.className =
    "menu-wide";


  cancelButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();


      closeLeaveMenu();


      /*
        元の勤務メニューに戻す
      */

      showShiftMenu(
        cell,
        staffName,
        date
      );

    }
  );


  buttons.appendChild(
    cancelButton
  );


  /*
    表示位置
  */

  positionMenuFromCell(
    menu,
    cell
  );

}


/* =========================================================
   メニュー位置調整
   ★ iPhone対応
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


  /*
    画面基準
  */

  menu.style.position =
    "fixed";


  /*
    いったん表示
  */

  menu.style.display =
    "block";


  menu.classList.add(
    "show"
  );


  /*
    画面からはみ出さないようにする
  */

  const rect =
    cell.getBoundingClientRect();


  const screenWidth =
    window.innerWidth;


  const screenHeight =
    window.innerHeight;


  const margin =
    10;


  const gap =
    6;


  /*
    実際のメニューサイズ
  */

  const menuRect =
    menu.getBoundingClientRect();


  /*
    横位置
  */

  let left =
    rect.left;


  /*
    右にはみ出る
  */

  if (
    left +
      menuRect.width >
    screenWidth -
      margin
  ) {

    left =
      screenWidth -
      menuRect.width -
      margin;

  }


  /*
    左にはみ出る
  */

  if (
    left <
    margin
  ) {

    left =
      margin;

  }


  /*
    縦位置
  */

  let top =
    rect.bottom +
    gap;


  /*
    下に入りきらない
  */

  if (
    top +
      menuRect.height >
    screenHeight -
      margin
  ) {

    const above =
      rect.top -
      menuRect.height -
      gap;


    /*
      上に入るなら上へ
    */

    if (
      above >=
      margin
    ) {

      top =
        above;

    }

  }


  /*
    上にも入りきらない
  */

  if (
    top <
    margin
  ) {

    top =
      margin;

  }


  /*
    画面高さを超える場合
    → メニュー内をスクロール
  */

  const availableHeight =
    screenHeight -
    top -
    margin;


  const finalMaxHeight =
    Math.max(
      160,
      availableHeight
    );


  menu.style.maxHeight =
    finalMaxHeight +
    "px";


  menu.style.overflowY =
    "auto";


  menu.style.webkitOverflowScrolling =
    "touch";


  /*
    最終位置
  */

  menu.style.left =
    Math.round(left) +
    "px";


  menu.style.top =
    Math.round(top) +
    "px";

}


/* =========================================================
   勤務メニューを閉じる
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


/* =========================================================
   休暇メニューを閉じる
========================================================= */

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
   休暇だけクリア
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
   勤務・休暇完全クリア
========================================================= */

async function clearWorkShift(
  staffName,
  date
) {

  if (!supabaseClient)
    return;


  try {

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
   職員保存
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


  if (
    appData.staff.some(
      (staff, index) =>

        staff.name === name &&

        index !==
          editingStaffIndex

    )
  ) {

    alert(
      "同じ職員名がすでにあります。"
    );

    return;

  }


  try {

    if (
      editingStaffIndex >= 0
    ) {

      const oldStaff =
        appData.staff[
          editingStaffIndex
        ];


      const oldName =
        oldStaff.name;


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
            oldStaff.id
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

      const sortOrder =
        appData.staff.length +
        1;


      const {
        data,
        error
      } =
        await supabaseClient

          .from("staff")

          .insert({

            name,

            sort_order:
              sortOrder

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


/* =========================================================
   職員編集
========================================================= */

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


  $("staffNameInput").value =
    "";


  $("addStaffButton").textContent =
    "職員を追加";

}


/* =========================================================
   職員並び替え
========================================================= */

async function moveStaff(
  index,
  direction
) {

  const target =
    index + direction;


  if (

    target < 0 ||

    target >=
      appData.staff.length

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


    alert(
      "並び順の変更に失敗しました。"
    );

  }

}


/* =========================================================
   職員削除
========================================================= */

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


/* =========================================================
   職員一覧
========================================================= */

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

          <div
            class="sort-buttons"
          >

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


          <div
            class="list-item-main"
          >

            <div
              class="list-item-title"
            >
              ${escapeHtml(
                staff.name
              )}
            </div>

          </div>


          <div
            class="list-actions"
          >

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

          .addEventListener(
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

          .addEventListener(
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

          .addEventListener(
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

          .addEventListener(
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
   勤務形態保存
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


/* =========================================================
   勤務形態編集
========================================================= */

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
   勤務形態削除
========================================================= */

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


    alert(
      "勤務形態の削除に失敗しました。"
    );

  }

}


/* =========================================================
   勤務形態一覧
========================================================= */

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


        let sub =
          "";


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
                sub
              )}
            </div>

          </div>


          <div
            class="list-actions"
          >

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

          .addEventListener(
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

          .addEventListener(
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
   休暇種類保存
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


      const old =
        appData.leaveTypes.find(
          item =>
            item.id ===
            editingLeaveTypeId
        );


      const oldName =
        old?.name;


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


/* =========================================================
   休暇種類編集
========================================================= */

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


  $("leaveTypeNameInput").value =
    "";


  $("leaveTypeColorInput").value =
    "#d9f2df";


  $("addLeaveTypeButton").textContent =
    "休暇種類を追加";

}


/* =========================================================
   休暇種類削除
========================================================= */

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


    alert(
      "休暇種類の削除に失敗しました。"
    );

  }

}


/* =========================================================
   休暇種類一覧
========================================================= */

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


          <div
            class="list-item-main"
          >

            <div
              class="list-item-title"
            >
              ${escapeHtml(
                leave.name
              )}
            </div>

          </div>


          <div
            class="list-actions"
          >

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

          .addEventListener(
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

          .addEventListener(
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
   休業日保存
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


  if (end < start) {

    alert(
      "終了日は開始日以降にしてください。"
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

        appData
          .companyHolidays[
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


      if (error)
        throw error;


      appData
        .companyHolidays
        .push(
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


/* =========================================================
   休業日編集
========================================================= */

function editCompanyHoliday(
  id
) {

  const holiday =
    appData
      .companyHolidays
      .find(
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


  $("companyHolidayName").value =
    "";


  $("companyHolidayStart").value =
    "";


  $("companyHolidayEnd").value =
    "";


  $("addCompanyHolidayButton").textContent =
    "休業日を追加";

}


/* =========================================================
   休業日削除
========================================================= */

async function deleteCompanyHoliday(
  id
) {

  const holiday =
    appData
      .companyHolidays
      .find(
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

        .from(
          "company_holidays"
        )

        .delete()

        .eq(
          "id",
          id
        );


    if (error)
      throw error;


    appData
      .companyHolidays =
      appData
        .companyHolidays
        .filter(
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


    alert(
      "休業日の削除に失敗しました。"
    );

  }

}


/* =========================================================
   休業日一覧
========================================================= */

function renderCompanyHolidayList() {

  const list =
    $("companyHolidayList");


  if (!list)
    return;


  list.innerHTML =
    "";


  appData
    .companyHolidays
    .forEach(
      holiday => {

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
              ${escapeHtml(
                holiday.name
              )}
            </div>


            <div
              class="list-item-sub"
            >

              ${escapeHtml(
                holiday.start_date
              )}

              ～

              ${escapeHtml(
                holiday.end_date
              )}

            </div>

          </div>


          <div
            class="list-actions"
          >

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

          .addEventListener(
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

          .addEventListener(
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
   明の時間
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


/* =========================================================
   アプリ設定
========================================================= */

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


  if (
    !start ||
    !end
  ) {

    alert(
      "開始と終了を入力してください。"
    );

    return;

  }


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


    setStatus(
      "「明」の時間を保存しました"
    );


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
   今月削除
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

              delete appData
                .shifts[
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

              delete appData
                .leaves[
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


    alert(
      "今月の削除に失敗しました。"
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
      `${selectedYear}年度（4月～翌3月）の勤務をすべて削除しますか？`
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

              date >=
                fiscalStart &&

              date <=
                fiscalEnd

            ) {

              delete appData
                .shifts[
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

              date >=
                fiscalStart &&

              date <=
                fiscalEnd

            ) {

              delete appData
                .leaves[
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


    alert(
      "年度削除に失敗しました。"
    );

  }

}


/* =========================================================
   カレンダー登録
   ★ webcal方式
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
   webcal登録
========================================================= */

function subscribeStaffCalendar() {

  const modal =
    $("calendarConfirm");


  if (!modal)
    return;


  const staffName =
    modal.dataset.staff;


  if (!staffName) {

    alert(
      "職員情報を取得できませんでした。"
    );


    closeCalendarModal();


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
      "この職員のカレンダー情報がありません。"
    );


    closeCalendarModal();


    return;

  }


  /*
    ★ webcal方式を維持
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

            table:
              "shift_types"

          },

          scheduleRealtimeReload

        )

        .on(

          "postgres_changes",

          {

            event: "*",

            schema: "public",

            table:
              "work_shifts"

          },

          scheduleRealtimeReload

        )

        .on(

          "postgres_changes",

          {

            event: "*",

            schema: "public",

            table:
              "company_holidays"

          },

          scheduleRealtimeReload

        )

        .on(

          "postgres_changes",

          {

            event: "*",

            schema: "public",

            table:
              "leave_types"

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

          document
            .visibilityState ===
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
   アプリ復帰
========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    if (

      document
        .visibilityState ===
        "visible"

    ) {

      /*
        iPhoneから戻ってきた時も
        メニューを勝手に表示しない
      */

      closeAllMenus();

      closeCalendarModal();


      loadAllFromSupabase(
        true
      );

    }

  }
);
