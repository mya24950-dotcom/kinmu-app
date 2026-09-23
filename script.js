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
  Array.from(document.querySelectorAll(selector));


let supabaseClient = null;

let cloudOperationBusy = false;

let selectedCalendarStaff = null;

let currentDate = new Date();

currentDate.setDate(1);


/* =========================================================
   データ
========================================================= */

function defaultAppData() {

  return {

    staff: [],

    shiftTypes: [],

    leaveTypes: [],

    companyHolidays: [],

    shifts: [],

    leaves: [],

    akeTime: {

      start: "05:30",

      end: "11:15"

    }

  };

}


let appData = defaultAppData();


/* =========================================================
   初期化
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    closeAllMenus();

    loadLocal();

    bindEvents();

    renderAll();

    updateStatus("ローカルデータ表示中");

    await initializeSupabase();

    await loadAllFromSupabase();

    startAutoSync();

  }
);


/* =========================================================
   エラー監視
========================================================= */

window.addEventListener(
  "error",
  event => {

    console.error(event.error || event.message);

    updateStatus(
      "エラー：" +
      String(event.message || "不明なエラー")
    );

  }
);


window.addEventListener(
  "unhandledrejection",
  event => {

    console.error(event.reason);

    updateStatus(
      "エラー：" +
      String(
        event.reason?.message ||
        event.reason ||
        "同期エラー"
      )
    );

  }
);


/* =========================================================
   Supabase
========================================================= */

async function initializeSupabase() {

  try {

    if (!window.supabase) {

      updateStatus(
        "Supabase読み込み失敗"
      );

      return false;

    }


    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );


    setupRealtime();


    updateStatus(
      "クラウド接続済み"
    );


    return true;

  } catch (error) {

    console.error(error);

    updateStatus(
      "Supabase接続エラー：" +
      error.message
    );

    return false;

  }

}


/* =========================================================
   ステータス
========================================================= */

function updateStatus(message) {

  const element =
    $("appStatus");

  if (!element) return;

  element.textContent =
    message;

}


/* =========================================================
   ローカル保存
========================================================= */

function saveLocal() {

  try {

    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(appData)
    );

  } catch (error) {

    console.error(
      "localStorage保存エラー",
      error
    );

  }

}


function loadLocal() {

  try {

    const raw =
      localStorage.getItem(
        LOCAL_STORAGE_KEY
      );

    if (!raw) return;

    const saved =
      JSON.parse(raw);

    appData = {

      ...defaultAppData(),

      ...saved,

      staff:
        Array.isArray(saved.staff)
          ? saved.staff
          : [],

      shiftTypes:
        Array.isArray(saved.shiftTypes)
          ? saved.shiftTypes
          : [],

      leaveTypes:
        Array.isArray(saved.leaveTypes)
          ? saved.leaveTypes
          : [],

      companyHolidays:
        Array.isArray(saved.companyHolidays)
          ? saved.companyHolidays
          : [],

      shifts:
        Array.isArray(saved.shifts)
          ? saved.shifts
          : [],

      leaves:
        Array.isArray(saved.leaves)
          ? saved.leaves
          : []

    };

  } catch (error) {

    console.error(
      "localStorage読み込みエラー",
      error
    );

    appData =
      defaultAppData();

  }

}


/* =========================================================
   全描画
========================================================= */

function renderAll() {

  closeAllMenus();

  renderSchedule();

  renderStaffList();

  renderShiftList();

  renderCompanyHolidayList();

  renderLeaveTypeList();

  renderAkeTime();

}


/* =========================================================
   イベント
========================================================= */

function bindEvents() {


  /* ナビ */

  $$(".nav-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;

          showPage(page);

        }

      );

    });


  /* 月 */

  $("prevMonth")?.addEventListener(
    "click",
    () => {

      currentDate.setMonth(
        currentDate.getMonth() - 1
      );

      renderSchedule();

    }
  );


  $("nextMonth")?.addEventListener(
    "click",
    () => {

      currentDate.setMonth(
        currentDate.getMonth() + 1
      );

      renderSchedule();

    }
  );


  /* 職員 */

  $("addStaffButton")?.addEventListener(
    "click",
    addStaff
  );


  /* 勤務形態 */

  $("addShiftButton")?.addEventListener(
    "click",
    addShiftType
  );


  /* 休業日 */

  $("addCompanyHolidayButton")
    ?.addEventListener(
      "click",
      addCompanyHoliday
    );


  /* 休暇種類 */

  $("addLeaveTypeButton")
    ?.addEventListener(
      "click",
      addLeaveType
    );


  /* 明 */

  $("saveAkeTimeButton")
    ?.addEventListener(
      "click",
      saveAkeTime
    );


  /* 月削除 */

  $("deleteMonthButton")
    ?.addEventListener(
      "click",
      deleteCurrentMonth
    );


  /* 年度削除 */

  $("deleteFiscalYearButton")
    ?.addEventListener(
      "click",
      deleteFiscalYear
    );


  /* カレンダー */

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


  /* 外側タップ */

  document.addEventListener(
    "click",
    event => {

      const shiftMenu =
        $("shiftMenu");

      const leaveMenu =
        $("leaveMenu");


      if (
        shiftMenu?.classList.contains("show") &&
        !shiftMenu.contains(event.target) &&
        !event.target.closest(".schedule-cell")
      ) {

        closeShiftMenu();

      }


      if (
        leaveMenu?.classList.contains("show") &&
        !leaveMenu.contains(event.target) &&
        !event.target.closest(".schedule-cell")
      ) {

        closeLeaveMenu();

      }

    }
  );


  /* ESC */

  document.addEventListener(
    "keydown",
    event => {

      if (event.key === "Escape") {

        closeAllMenus();

      }

    }
  );

}


/* =========================================================
   ページ切替
========================================================= */

function showPage(page) {

  const pages = [
    "schedule",
    "staff",
    "shift",
    "holiday",
    "leaveType"
  ];


  pages.forEach(name => {

    const element =
      $(name + "Page");

    if (!element) return;

    element.style.display =
      name === page
        ? ""
        : "none";

  });


  $$(".nav-button")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });


  closeAllMenus();


  if (page === "schedule") {

    renderSchedule();

  }

}


/* =========================================================
   勤務表
========================================================= */

function renderSchedule() {

  closeAllMenus();


  const header =
    $("scheduleHeader");

  const body =
    $("scheduleBody");


  if (!header || !body) {

    updateStatus(
      "勤務表HTMLが見つかりません"
    );

    return;

  }


  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  const days =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  $("currentMonth").textContent =
    `${year}年${month + 1}月`;


  header.innerHTML = "";

  body.innerHTML = "";


  /* =========================
     ヘッダー
  ========================== */

  const staffHeader =
    document.createElement("th");

  staffHeader.className =
    "staff-header";

  staffHeader.textContent =
    "職員";

  header.appendChild(
    staffHeader
  );


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
      document.createElement("th");

    th.className =
      "date-header";


    const dow =
      date.getDay();


    if (dow === 0) {

      th.classList.add(
        "sunday-header"
      );

    }

    if (dow === 6) {

      th.classList.add(
        "saturday-header"
      );

    }


    th.innerHTML = `
      <div class="day-number">
        ${day}
      </div>
      <div class="weekday">
        ${getWeekday(dow)}
      </div>
    `;


    header.appendChild(th);

  }


  /* カレンダー列 */

  const calendarHeader =
    document.createElement("th");

  calendarHeader.className =
    "calendar-cell";

  calendarHeader.textContent =
    "📅";

  header.appendChild(
    calendarHeader
  );


  /* 月間合計 */

  appData.shiftTypes.forEach(
    shift => {

      const th =
        document.createElement("th");

      th.className =
        "summary-header";

      th.innerHTML =
        `
        合計<br>
        ${escapeHtml(shift.name)}
        `;

      header.appendChild(th);

    }
  );


  /* 年度累計 */

  appData.shiftTypes.forEach(
    shift => {

      const th =
        document.createElement("th");

      th.className =
        "summary-header";

      th.innerHTML =
        `
        累計<br>
        ${escapeHtml(shift.name)}
        `;

      header.appendChild(th);

    }
  );


  /* =========================
     職員行
  ========================== */

  appData.staff
    .filter(
      staff =>
        staff.name !== "明"
    )
    .forEach(
      staff => {

        const tr =
          document.createElement("tr");


        /* 職員名 */

        const nameCell =
          document.createElement("td");

        nameCell.className =
          "staff-cell";


        nameCell.innerHTML =
          `
          <div class="staff-name">
            ${escapeHtml(staff.name)}
          </div>
          `;


        tr.appendChild(
          nameCell
        );


        /* 日付 */

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
            formatDate(date);


          const td =
            document.createElement("td");

          td.className =
            "schedule-cell";


          const dow =
            date.getDay();


          if (
            dow === 0 ||
            dow === 6
          ) {

            td.classList.add(
              "weekend-cell"
            );

          }


          if (
            isHoliday(
              dateKey
            )
          ) {

            td.classList.add(
              "holiday-cell"
            );

          }


          const record =
            getShiftRecord(
              staff.name,
              dateKey
            );


          td.innerHTML =
            `
            <div class="cell-content">
              ${getCellText(record)}
            </div>
            `;


          td.addEventListener(
            "click",
            event => {

              event.stopPropagation();

              showShiftMenu(
                td,
                staff.name,
                dateKey
              );

            }
          );


          tr.appendChild(td);

        }


        /* カレンダー */

        const calendarCell =
          document.createElement("td");

        calendarCell.className =
          "calendar-cell";


        const calendarButton =
          document.createElement("button");

        calendarButton.type =
          "button";

        calendarButton.className =
          "calendar-subscribe-button";

        calendarButton.textContent =
          "📅";


        calendarButton.addEventListener(
          "click",
          event => {

            event.stopPropagation();

            openCalendarModal(
              staff
            );

          }
        );


        calendarCell.appendChild(
          calendarButton
        );


        tr.appendChild(
          calendarCell
        );


        /* 月間合計 */

        appData.shiftTypes
          .forEach(
            shift => {

              const td =
                document.createElement("td");

              td.className =
                "summary-cell";


              const count =
                countShiftInMonth(
                  staff.name,
                  year,
                  month,
                  shift.name
                );


              td.innerHTML =
                `
                <span class="summary-number">
                  ${count}
                </span>
                `;


              tr.appendChild(td);

            }
          );


        /* 年度累計 */

        appData.shiftTypes
          .forEach(
            shift => {

              const td =
                document.createElement("td");

              td.className =
                "summary-cell";


              const count =
                countShiftFiscalYear(
                  staff.name,
                  year,
                  shift.name
                );


              td.innerHTML =
                `
                <span class="summary-number">
                  ${count}
                </span>
                `;


              tr.appendChild(td);

            }
          );


        body.appendChild(tr);

      }
    );


  updateStatus(
    "表示中"
  );

}


/* =========================================================
   セル文字
========================================================= */

function getCellText(record) {

  if (!record) {

    return "";

  }


  if (record.leave_type) {

    return `
      <span class="leave-cell">
        ${escapeHtml(record.leave_type)}
      </span>
    `;

  }


  if (record.shift_name) {

    return escapeHtml(
      record.shift_name
    );

  }


  return "";

}


/* =========================================================
   日付
========================================================= */

function formatDate(date) {

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

  return `${y}-${m}-${d}`;

}


function getWeekday(day) {

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
   勤務取得
========================================================= */

function getShiftRecord(
  staffName,
  date
) {

  return appData.shifts.find(
    item =>
      item.staff_name === staffName &&
      item.work_date === date
  ) || null;

}


/* =========================================================
   勤務メニュー
========================================================= */

function showShiftMenu(
  cell,
  staffName,
  dateKey
) {

  closeLeaveMenu();

  const menu =
    $("shiftMenu");

  const buttons =
    $("shiftMenuButtons");


  if (!menu || !buttons) {

    return;

  }


  buttons.innerHTML = "";


  /* 勤務形態 */

  appData.shiftTypes
    .forEach(
      shift => {

        const button =
          document.createElement("button");

        button.type =
          "button";

        button.className =
          "shift-menu-button";

        button.textContent =
          shift.name;


        button.addEventListener(
          "click",
          async event => {

            event.stopPropagation();

            await setShift(
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


  /* 勤務クリア */

  const clearButton =
    document.createElement("button");

  clearButton.type =
    "button";

  clearButton.className =
    "shift-menu-button clear";

  clearButton.textContent =
    "勤務をクリア";


  clearButton.addEventListener(
    "click",
    async event => {

      event.stopPropagation();

      await clearShift(
        staffName,
        dateKey
      );

    }
  );


  buttons.appendChild(
    clearButton
  );


  /* 休暇 */

  const leaveButton =
    document.createElement("button");

  leaveButton.type =
    "button";

  leaveButton.className =
    "shift-menu-button leave";

  leaveButton.textContent =
    "休暇を選択";


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


  openMenu(
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
  dateKey
) {

  closeShiftMenu();

  const menu =
    $("leaveMenu");

  const buttons =
    $("leaveMenuButtons");


  if (!menu || !buttons) {

    return;

  }


  buttons.innerHTML = "";


  appData.leaveTypes
    .forEach(
      leave => {

        const button =
          document.createElement("button");

        button.type =
          "button";

        button.className =
          "shift-menu-button";

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
              dateKey,
              leave.name
            );

          }
        );


        buttons.appendChild(
          button
        );

      }
    );


  const clearButton =
    document.createElement("button");

  clearButton.type =
    "button";

  clearButton.className =
    "shift-menu-button clear";

  clearButton.textContent =
    "休暇をクリア";


  clearButton.addEventListener(
    "click",
    async event => {

      event.stopPropagation();

      await clearShift(
        staffName,
        dateKey
      );

    }
  );


  buttons.appendChild(
    clearButton
  );


  const backButton =
    document.createElement("button");

  backButton.type =
    "button";

  backButton.className =
    "shift-menu-button";

  backButton.textContent =
    "← 勤務選択に戻る";


  backButton.addEventListener(
    "click",
    event => {

      event.stopPropagation();

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


  openMenu(
    menu,
    cell
  );

}


/* =========================================================
   メニュー表示
   右 → 左 → 画面中央
========================================================= */

function openMenu(
  menu,
  cell
) {

  if (!menu || !cell) return;


  closeAllMenus();


  menu.style.display =
    "block";

  menu.classList.add(
    "show"
  );


  menu.style.left =
    "-10000px";

  menu.style.top =
    "-10000px";


  requestAnimationFrame(
    () => {

      positionMenu(
        menu,
        cell
      );

    }
  );

}


/* =========================================================
   メニュー位置
========================================================= */

function positionMenu(
  menu,
  cell
) {

  if (!menu || !cell) return;


  const rect =
    cell.getBoundingClientRect();


  const viewport =
    window.visualViewport;


  const screenWidth =
    viewport
      ? viewport.width
      : window.innerWidth;


  const screenHeight =
    viewport
      ? viewport.height
      : window.innerHeight;


  const offsetLeft =
    viewport
      ? viewport.offsetLeft
      : 0;


  const offsetTop =
    viewport
      ? viewport.offsetTop
      : 0;


  const margin = 10;

  const gap = 8;


  const menuRect =
    menu.getBoundingClientRect();


  let width =
    menuRect.width;


  let height =
    menuRect.height;


  /* 高すぎる場合 */

  const maxHeight =
    screenHeight -
    margin * 2;


  if (
    height >
    maxHeight
  ) {

    menu.style.maxHeight =
      maxHeight + "px";

    menu.style.overflowY =
      "auto";

    height =
      maxHeight;

  }


  /* 右 */

  let left =
    rect.right +
    gap;


  const rightLimit =
    offsetLeft +
    screenWidth -
    margin;


  /* 右に入らない */

  if (
    left + width >
    rightLimit
  ) {

    /* 左 */

    left =
      rect.left -
      width -
      gap;

  }


  /* 左にも入らない */

  if (
    left <
    offsetLeft + margin
  ) {

    /* 画面中央寄り */

    left =
      offsetLeft +
      (
        screenWidth -
        width
      ) / 2;

  }


  /* 最終的に画面内へ */

  const minLeft =
    offsetLeft +
    margin;


  const maxLeft =
    rightLimit -
    width;


  left =
    Math.max(
      minLeft,
      Math.min(
        left,
        maxLeft
      )
    );


  /* 上下 */

  let top =
    rect.top;


  const bottomLimit =
    offsetTop +
    screenHeight -
    margin;


  if (
    top + height >
    bottomLimit
  ) {

    top =
      rect.bottom -
      height;

  }


  if (
    top <
    offsetTop + margin
  ) {

    top =
      offsetTop +
      margin;

  }


  menu.style.left =
    Math.round(left) +
    "px";


  menu.style.top =
    Math.round(top) +
    "px";

}


/* =========================================================
   メニューを閉じる
========================================================= */

function closeShiftMenu() {

  const menu =
    $("shiftMenu");

  if (!menu) return;

  menu.classList.remove(
    "show"
  );

  menu.style.display =
    "none";

}


function closeLeaveMenu() {

  const menu =
    $("leaveMenu");

  if (!menu) return;

  menu.classList.remove(
    "show"
  );

  menu.style.display =
    "none";

}


function closeAllMenus() {

  closeShiftMenu();

  closeLeaveMenu();

}


/* =========================================================
   勤務登録
========================================================= */

async function setShift(
  staffName,
  date,
  shiftName
) {

  closeAllMenus();


  appData.shifts =
    appData.shifts.filter(
      item =>
        !(
          item.staff_name === staffName &&
          item.work_date === date
        )
    );


  appData.shifts.push({

    staff_name:
      staffName,

    work_date:
      date,

    shift_name:
      shiftName,

    leave_type:
      null

  });


  saveLocal();

  renderSchedule();


  await saveShiftToCloud(
    staffName,
    date,
    shiftName,
    null
  );

}


/* =========================================================
   休暇登録
========================================================= */

async function setLeave(
  staffName,
  date,
  leaveName
) {

  closeAllMenus();


  appData.shifts =
    appData.shifts.filter(
      item =>
        !(
          item.staff_name === staffName &&
          item.work_date === date
        )
    );


  appData.shifts.push({

    staff_name:
      staffName,

    work_date:
      date,

    shift_name:
      null,

    leave_type:
      leaveName

  });


  saveLocal();

  renderSchedule();


  await saveShiftToCloud(
    staffName,
    date,
    null,
    leaveName
  );

}


/* =========================================================
   勤務削除
========================================================= */

async function clearShift(
  staffName,
  date
) {

  closeAllMenus();


  appData.shifts =
    appData.shifts.filter(
      item =>
        !(
          item.staff_name === staffName &&
          item.work_date === date
        )
    );


  saveLocal();

  renderSchedule();


  await deleteShiftFromCloud(
    staffName,
    date
  );

}


/* =========================================================
   Supabase 勤務保存
========================================================= */

async function saveShiftToCloud(
  staffName,
  date,
  shiftName,
  leaveType
) {

  if (!supabaseClient) {

    updateStatus(
      "ローカル保存済み"
    );

    return;

  }


  try {

    const deleteResult =
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


    if (deleteResult.error) {

      throw deleteResult.error;

    }


    if (
      shiftName ||
      leaveType
    ) {

      const insertResult =
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
              leaveType

          });


      if (insertResult.error) {

        throw insertResult.error;

      }

    }


    updateStatus(
      "同期済み"
    );

  } catch (error) {

    console.error(error);

    updateStatus(
      "同期エラー：work_shifts / " +
      error.message
    );

  }

}


/* =========================================================
   Supabase 勤務削除
========================================================= */

async function deleteShiftFromCloud(
  staffName,
  date
) {

  if (!supabaseClient) return;


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
          date
        );


    if (result.error) {

      throw result.error;

    }


    updateStatus(
      "同期済み"
    );

  } catch (error) {

    console.error(error);

    updateStatus(
      "同期エラー：削除 / " +
      error.message
    );

  }

}


/* =========================================================
   Supabase 全読み込み
========================================================= */

async function loadAllFromSupabase() {

  if (!supabaseClient) return;


  if (cloudOperationBusy) return;


  cloudOperationBusy = true;


  try {

    updateStatus(
      "クラウドから同期中..."
    );


    const [
      staffResult,
      shiftResult,
      leaveResult,
      holidayResult,
      workResult,
      settingResult
    ] =
      await Promise.all([

        supabaseClient
          .from("staff")
          .select("*")
          .order(
            "sort_order",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("shift_types")
          .select("*")
          .order(
            "created_at",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("leave_types")
          .select("*")
          .order(
            "created_at",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("company_holidays")
          .select("*")
          .order(
            "start_date",
            {
              ascending: true
            }
          ),

        supabaseClient
          .from("work_shifts")
          .select("*"),

        supabaseClient
          .from("app_settings")
          .select("*")

      ]);


    if (staffResult.error)
      throw new Error(
        "staff: " +
        staffResult.error.message
      );


    if (shiftResult.error)
      throw new Error(
        "shift_types: " +
        shiftResult.error.message
      );


    if (leaveResult.error)
      throw new Error(
        "leave_types: " +
        leaveResult.error.message
      );


    if (holidayResult.error)
      throw new Error(
        "company_holidays: " +
        holidayResult.error.message
      );


    if (workResult.error)
      throw new Error(
        "work_shifts: " +
        workResult.error.message
      );


    if (settingResult.error)
      throw new Error(
        "app_settings: " +
        settingResult.error.message
      );


    appData.staff =
      (staffResult.data || [])
        .filter(
          item =>
            item.name !== "明"
        );


    appData.shiftTypes =
      shiftResult.data || [];


    appData.leaveTypes =
      leaveResult.data || [];


    appData.companyHolidays =
      holidayResult.data || [];


    appData.shifts =
      workResult.data || [];


    const settings =
      settingResult.data || [];


    const akeStart =
      settings.find(
        item =>
          item.key === "ake_start"
      );


    const akeEnd =
      settings.find(
        item =>
          item.key === "ake_end"
      );


    if (akeStart?.value) {

      appData.akeTime.start =
        akeStart.value;

    }


    if (akeEnd?.value) {

      appData.akeTime.end =
        akeEnd.value;

    }


    saveLocal();

    renderAll();


    updateStatus(
      "同期済み"
    );


  } catch (error) {

    console.error(
      "Supabase同期エラー",
      error
    );


    updateStatus(
      "同期エラー：" +
      error.message
    );


    /*
      クラウドに失敗しても
      ローカルデータはそのまま表示
    */

    renderAll();

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* =========================================================
   Realtime
========================================================= */

function setupRealtime() {

  if (!supabaseClient) return;


  try {

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
        () => {

          loadAllFromSupabase();

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

          loadAllFromSupabase();

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

          loadAllFromSupabase();

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

          loadAllFromSupabase();

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

          loadAllFromSupabase();

        }
      )
      .subscribe();

  } catch (error) {

    console.error(
      "Realtime設定エラー",
      error
    );

  }

}


/* =========================================================
   自動同期
========================================================= */

function startAutoSync() {

  setInterval(
    async () => {

      if (
        document.visibilityState ===
        "visible"
      ) {

        await loadAllFromSupabase();

      }

    },
    15000
  );

}


/* =========================================================
   職員
========================================================= */

async function addStaff() {

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
      staff =>
        staff.name === name
    )
  ) {

    alert(
      "同じ職員名があります。"
    );

    return;

  }


  const token =
    crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() +
        "-" +
        Math.random();


  const staff = {

    name,

    calendar_token:
      token,

    sort_order:
      appData.staff.length + 1

  };


  if (supabaseClient) {

    try {

      const result =
        await supabaseClient
          .from("staff")
          .insert(staff)
          .select()
          .single();


      if (result.error) {

        throw result.error;

      }


      appData.staff.push(
        result.data
      );


    } catch (error) {

      console.error(error);

      updateStatus(
        "同期エラー：staff / " +
        error.message
      );

      return;

    }

  } else {

    appData.staff.push(
      {
        id:
          crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now(),
        ...staff
      }
    );

  }


  input.value = "";

  saveLocal();

  renderAll();

  updateStatus(
    "同期済み"
  );

}


/* =========================================================
   職員一覧
========================================================= */

function renderStaffList() {

  const list =
    $("staffList");

  const count =
    $("staffCount");


  if (!list) return;


  list.innerHTML = "";


  const staff =
    appData.staff.filter(
      item =>
        item.name !== "明"
    );


  if (count) {

    count.textContent =
      `職員数：${staff.length}人`;

  }


  staff.forEach(
    item => {

      const row =
        document.createElement("div");

      row.className =
        "list-item";


      row.innerHTML =
        `
        <div class="list-main">
          <div class="list-title">
            ${escapeHtml(item.name)}
          </div>
        </div>

        <button
          type="button"
          class="delete-button"
        >
          削除
        </button>
        `;


      row.querySelector(
        ".delete-button"
      ).addEventListener(
        "click",
        () =>
          deleteStaff(item)
      );


      list.appendChild(row);

    }
  );

}


/* =========================================================
   職員削除
========================================================= */

async function deleteStaff(
  staff
) {

  if (
    !confirm(
      `${staff.name}を削除しますか？`
    )
  ) {

    return;

  }


  if (supabaseClient && staff.id) {

    const result =
      await supabaseClient
        .from("staff")
        .delete()
        .eq(
          "id",
          staff.id
        );


    if (result.error) {

      updateStatus(
        "同期エラー：staff / " +
        result.error.message
      );

      return;

    }

  }


  appData.staff =
    appData.staff.filter(
      item =>
        item !== staff
    );


  appData.shifts =
    appData.shifts.filter(
      item =>
        item.staff_name !==
        staff.name
    );


  saveLocal();

  renderAll();

}


/* =========================================================
   勤務形態
========================================================= */

async function addShiftType() {

  const name =
    $("shiftNameInput")
      ?.value.trim();

  const start =
    $("shiftStartInput")
      ?.value || "";

  const end =
    $("shiftEndInput")
      ?.value || "";

  const breakTime =
    $("shiftBreakInput")
      ?.value.trim() || "";


  if (!name) {

    alert(
      "勤務形態名を入力してください。"
    );

    return;

  }


  const record = {

    name,

    start_time:
      start,

    end_time:
      end,

    break_time:
      breakTime

  };


  if (supabaseClient) {

    const result =
      await supabaseClient
        .from("shift_types")
        .insert(record)
        .select()
        .single();


    if (result.error) {

      updateStatus(
        "同期エラー：shift_types / " +
        result.error.message
      );

      return;

    }


    appData.shiftTypes.push(
      result.data
    );

  } else {

    appData.shiftTypes.push(
      {
        id:
          Date.now(),
        ...record
      }
    );

  }


  $("shiftNameInput").value = "";

  $("shiftStartInput").value = "";

  $("shiftEndInput").value = "";

  $("shiftBreakInput").value = "";


  saveLocal();

  renderAll();

}


/* =========================================================
   勤務形態一覧
========================================================= */

function renderShiftList() {

  const list =
    $("shiftList");

  if (!list) return;


  list.innerHTML = "";


  appData.shiftTypes.forEach(
    item => {

      const row =
        document.createElement("div");

      row.className =
        "list-item";


      row.innerHTML =
        `
        <div class="list-main">

          <div class="list-title">
            ${escapeHtml(item.name)}
          </div>

          <div class="list-subtitle">
            ${escapeHtml(item.start_time || "")}
            〜
            ${escapeHtml(item.end_time || "")}
            ${item.break_time
              ? " / 休憩 " +
                escapeHtml(item.break_time)
              : ""}
          </div>

        </div>

        <button
          type="button"
          class="delete-button"
        >
          削除
        </button>
        `;


      row.querySelector(
        ".delete-button"
      ).addEventListener(
        "click",
        () =>
          deleteShiftType(item)
      );


      list.appendChild(row);

    }
  );

}


/* =========================================================
   勤務形態削除
========================================================= */

async function deleteShiftType(
  item
) {

  if (
    !confirm(
      `${item.name}を削除しますか？`
    )
  ) {

    return;

  }


  if (
    supabaseClient &&
    item.id
  ) {

    const result =
      await supabaseClient
        .from("shift_types")
        .delete()
        .eq(
          "id",
          item.id
        );


    if (result.error) {

      updateStatus(
        "同期エラー：shift_types / " +
        result.error.message
      );

      return;

    }

  }


  appData.shiftTypes =
    appData.shiftTypes.filter(
      shift =>
        shift !== item
    );


  saveLocal();

  renderAll();

}


/* =========================================================
   休暇種類
========================================================= */

async function addLeaveType() {

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


  const record = {

    name,

    color

  };


  if (supabaseClient) {

    const result =
      await supabaseClient
        .from("leave_types")
        .insert(record)
        .select()
        .single();


    if (result.error) {

      updateStatus(
        "同期エラー：leave_types / " +
        result.error.message
      );

      return;

    }


    appData.leaveTypes.push(
      result.data
    );

  } else {

    appData.leaveTypes.push(
      {
        id: Date.now(),
        ...record
      }
    );

  }


  $("leaveTypeNameInput").value = "";

  saveLocal();

  renderAll();

}


/* =========================================================
   休暇一覧
========================================================= */

function renderLeaveTypeList() {

  const list =
    $("leaveTypeList");

  if (!list) return;


  list.innerHTML = "";


  appData.leaveTypes.forEach(
    item => {

      const row =
        document.createElement("div");

      row.className =
        "list-item";


      row.innerHTML =
        `
        <div class="list-main">

          <div class="list-title">
            ${escapeHtml(item.name)}
          </div>

        </div>

        <button
          type="button"
          class="delete-button"
        >
          削除
        </button>
        `;


      row.querySelector(
        ".delete-button"
      ).addEventListener(
        "click",
        () =>
          deleteLeaveType(item)
      );


      list.appendChild(row);

    }
  );

}


/* =========================================================
   休暇種類削除
========================================================= */

async function deleteLeaveType(
  item
) {

  if (
    !confirm(
      `${item.name}を削除しますか？`
    )
  ) {

    return;

  }


  if (
    supabaseClient &&
    item.id
  ) {

    const result =
      await supabaseClient
        .from("leave_types")
        .delete()
        .eq(
          "id",
          item.id
        );


    if (result.error) {

      updateStatus(
        "同期エラー：leave_types / " +
        result.error.message
      );

      return;

    }

  }


  appData.leaveTypes =
    appData.leaveTypes.filter(
      leave =>
        leave !== item
    );


  saveLocal();

  renderAll();

}


/* =========================================================
   休業日
========================================================= */

async function addCompanyHoliday() {

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
    !start
  ) {

    alert(
      "休業日名と開始日を入力してください。"
    );

    return;

  }


  const record = {

    name,

    start_date:
      start,

    end_date:
      end

  };


  if (supabaseClient) {

    const result =
      await supabaseClient
        .from("company_holidays")
        .insert(record)
        .select()
        .single();


    if (result.error) {

      updateStatus(
        "同期エラー：company_holidays / " +
        result.error.message
      );

      return;

    }


    appData.companyHolidays.push(
      result.data
    );

  } else {

    appData.companyHolidays.push(
      {
        id: Date.now(),
        ...record
      }
    );

  }


  $("companyHolidayName").value = "";

  $("companyHolidayStart").value = "";

  $("companyHolidayEnd").value = "";


  saveLocal();

  renderAll();

}


/* =========================================================
   休業日一覧
========================================================= */

function renderCompanyHolidayList() {

  const list =
    $("companyHolidayList");

  if (!list) return;


  list.innerHTML = "";


  appData.companyHolidays.forEach(
    item => {

      const row =
        document.createElement("div");

      row.className =
        "list-item";


      row.innerHTML =
        `
        <div class="list-main">

          <div class="list-title">
            ${escapeHtml(item.name)}
          </div>

          <div class="list-subtitle">
            ${item.start_date}
            ${item.end_date &&
              item.end_date !== item.start_date
              ? " 〜 " +
                item.end_date
              : ""}
          </div>

        </div>

        <button
          type="button"
          class="delete-button"
        >
          削除
        </button>
        `;


      row.querySelector(
        ".delete-button"
      ).addEventListener(
        "click",
        () =>
          deleteCompanyHoliday(item)
      );


      list.appendChild(row);

    }
  );

}


/* =========================================================
   休業日削除
========================================================= */

async function deleteCompanyHoliday(
  item
) {

  if (
    !confirm(
      `${item.name}を削除しますか？`
    )
  ) {

    return;

  }


  if (
    supabaseClient &&
    item.id
  ) {

    const result =
      await supabaseClient
        .from("company_holidays")
        .delete()
        .eq(
          "id",
          item.id
        );


    if (result.error) {

      updateStatus(
        "同期エラー：company_holidays / " +
        result.error.message
      );

      return;

    }

  }


  appData.companyHolidays =
    appData.companyHolidays.filter(
      holiday =>
        holiday !== item
    );


  saveLocal();

  renderAll();

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
      appData.akeTime.start;

  }


  if (end) {

    end.value =
      appData.akeTime.end;

  }

}


async function saveAkeTime() {

  const start =
    $("akeStartInput").value;

  const end =
    $("akeEndInput").value;


  appData.akeTime = {

    start,

    end

  };


  saveLocal();


  if (supabaseClient) {

    try {

      const results =
        await Promise.all([

          supabaseClient
            .from("app_settings")
            .upsert({
              key: "ake_start",
              value: start
            }),

          supabaseClient
            .from("app_settings")
            .upsert({
              key: "ake_end",
              value: end
            })

        ]);


      for (
        const result of results
      ) {

        if (result.error) {

          throw result.error;

        }

      }


    } catch (error) {

      updateStatus(
        "同期エラー：app_settings / " +
        error.message
      );

      return;

    }

  }


  updateStatus(
    "明の時間を保存しました"
  );

  renderSchedule();

}


/* =========================================================
   休日判定
========================================================= */

function isHoliday(dateKey) {

  return appData.companyHolidays.some(
    holiday =>
      dateKey >= holiday.start_date &&
      dateKey <= (
        holiday.end_date ||
        holiday.start_date
      )
  );

}


/* =========================================================
   勤務数：月
========================================================= */

function countShiftInMonth(
  staffName,
  year,
  month,
  shiftName
) {

  let count = 0;


  appData.shifts.forEach(
    item => {

      if (
        item.staff_name !==
        staffName
      ) {

        return;

      }


      if (
        item.shift_name !==
        shiftName
      ) {

        return;

      }


      const date =
        new Date(
          item.work_date +
          "T00:00:00"
        );


      if (
        date.getFullYear() ===
          year &&
        date.getMonth() ===
          month
      ) {

        count++;

      }

    }
  );


  return count;

}


/* =========================================================
   年度
   4月〜翌3月
========================================================= */

function countShiftFiscalYear(
  staffName,
  year,
  shiftName
) {

  const fiscalStart =
    year;


  const fiscalEnd =
    year + 1;


  let count = 0;


  appData.shifts.forEach(
    item => {

      if (
        item.staff_name !==
        staffName
      ) {

        return;

      }


      if (
        item.shift_name !==
        shiftName
      ) {

        return;

      }


      const date =
        new Date(
          item.work_date +
          "T00:00:00"
        );


      const y =
        date.getFullYear();

      const m =
        date.getMonth();


      const inFiscalYear =
        (
          y === fiscalStart &&
          m >= 3
        ) ||
        (
          y === fiscalEnd &&
          m <= 2
        );


      if (inFiscalYear) {

        count++;

      }

    }
  );


  return count;

}


/* =========================================================
   カレンダー
========================================================= */

function openCalendarModal(
  staff
) {

  selectedCalendarStaff =
    staff;


  const modal =
    $("calendarConfirm");


  const title =
    $("calendarConfirmTitle");

  const text =
    $("calendarConfirmText");


  if (!modal) return;


  if (title) {

    title.textContent =
      "カレンダー登録";

  }


  if (text) {

    text.textContent =
      `${staff.name}の勤務をカレンダーに登録しますか？`;

  }


  closeAllMenus();


  modal.classList.add(
    "show"
  );

}


function closeCalendarModal() {

  const modal =
    $("calendarConfirm");

  if (!modal) return;

  modal.classList.remove(
    "show"
  );

}


/* =========================================================
   webcal://
========================================================= */

function subscribeStaffCalendar() {

  if (
    !selectedCalendarStaff
  ) {

    closeCalendarModal();

    return;

  }


  const token =
    selectedCalendarStaff.calendar_token;


  if (!token) {

    alert(
      "この職員にはカレンダートークンがありません。"
    );

    return;

  }


  const webcalUrl =
    "webcal://" +
    SUPABASE_URL.replace(
      "https://",
      ""
    ) +
    "/functions/v1/staff-calendar?token=" +
    encodeURIComponent(token);


  closeCalendarModal();


  window.location.href =
    webcalUrl;

}


/* =========================================================
   月削除
========================================================= */

async function deleteCurrentMonth() {

  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  if (
    !confirm(
      `${year}年${month + 1}月の勤務をすべて削除しますか？`
    )
  ) {

    return;

  }


  const prefix =
    `${year}-${String(month + 1).padStart(2,"0")}`;


  appData.shifts =
    appData.shifts.filter(
      item =>
        !item.work_date.startsWith(
          prefix
        )
    );


  saveLocal();

  renderSchedule();


  if (supabaseClient) {

    try {

      const firstDate =
        `${prefix}-01`;

      const lastDay =
        new Date(
          year,
          month + 1,
          0
        ).getDate();

      const lastDate =
        `${prefix}-${String(lastDay).padStart(2,"0")}`;


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


      updateStatus(
        "今月の勤務を削除しました"
      );

    } catch (error) {

      updateStatus(
        "同期エラー：月削除 / " +
        error.message
      );

    }

  }

}


/* =========================================================
   年度削除
========================================================= */

async function deleteFiscalYear() {

  const year =
    currentDate.getFullYear();


  if (
    !confirm(
      `${year}年度（4月〜翌3月）の勤務をすべて削除しますか？`
    )
  ) {

    return;

  }


  const startDate =
    `${year}-04-01`;


  const endDate =
    `${year + 1}-03-31`;


  appData.shifts =
    appData.shifts.filter(
      item =>
        !(
          item.work_date >= startDate &&
          item.work_date <= endDate
        )
    );


  saveLocal();

  renderSchedule();


  if (supabaseClient) {

    try {

      const result =
        await supabaseClient
          .from("work_shifts")
          .delete()
          .gte(
            "work_date",
            startDate
          )
          .lte(
            "work_date",
            endDate
          );


      if (result.error) {

        throw result.error;

      }


      updateStatus(
        "年度勤務を削除しました"
      );

    } catch (error) {

      updateStatus(
        "同期エラー：年度削除 / " +
        error.message
      );

    }

  }

}


/* =========================================================
   HTMLエスケープ
========================================================= */

function escapeHtml(value) {

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
