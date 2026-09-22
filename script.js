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
   ※休業設定・明け時間などに使用
================================================== */

const STORAGE_KEY =
  "workScheduleAppData";


/* ==================================================
   アプリデータ
================================================== */

let appData = {

  staff: [],

  shiftTypes: [],

  companyHolidays: [],

  shifts: {},

  akeTime: {
    start: "05:30",
    end: "11:15"
  }

};


let currentDate = new Date();

currentDate.setDate(1);


let editingStaffIndex = -1;

let editingShiftIndex = -1;

let selectedCell = null;

let publicHolidays = {};


/* ==================================================
   初期化
================================================== */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  try {

    /*
      Supabase JSを読み込む
    */

    const module =
      await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
      );


    supabaseClient =
      module.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
      );


    /*
      ローカル設定読み込み
    */

    loadLocalData();


    /*
      イベント設定
    */

    bindEvents();


    /*
      Supabaseからデータ取得
    */

    await loadAllFromSupabase();


    /*
      画面表示
    */

    renderAll();


    /*
      公休日
    */

    loadPublicHolidays();


    /*
      Realtime開始
    */

    setupRealtime();


  } catch (error) {

    console.error(
      "初期化エラー",
      error
    );

    alert(
      "Supabaseへの接続に失敗しました。"
    );

  }

}


/* ==================================================
   ローカルデータ
   休業設定・明け時間のみ
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


  /*
    職員
  */

  const staffResult =
    await supabaseClient

      .from("staff")

      .select(
        "id,name,created_at"
      )

      .order(
        "created_at",
        {
          ascending: true
        }
      );


  if (staffResult.error) {

    throw staffResult.error;

  }


  /*
    勤務形態
  */

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


  /*
    勤務
  */

  const workResult =
    await supabaseClient

      .from("work_shifts")

      .select(
        "id,staff_name,work_date,shift_name"
      );


  if (workResult.error) {

    throw workResult.error;

  }


  /*
    職員データ
  */

  appData.staff =
    (staffResult.data || [])
      .map(row => ({

        id:
          row.id,

        name:
          String(
            row.name || ""
          )

      }))
      .filter(
        row =>
          row.name &&
          row.name !== "明"
      );


  /*
    勤務形態
  */

  appData.shiftTypes =
    (shiftResult.data || [])
      .map(row => ({

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

      }))
      .filter(
        row =>
          row.name &&
          row.name !== "明"
      );


  /*
    勤務データを
    画面用オブジェクトに変換
  */

  appData.shifts = {};


  appData.staff.forEach(
    staff => {

      appData.shifts[
        staff.name
      ] = {};

    }
  );


  (workResult.data || [])
    .forEach(row => {

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
      ] =
        row.shift_name || "";

    });


}


/* ==================================================
   Realtime
================================================== */

let realtimeChannel = null;
let realtimeReloadTimer = null;


/* ==================================================
   Realtime開始
================================================== */

function setupRealtime() {

  if (!supabaseClient) {

    console.error(
      "Supabaseクライアントがありません"
    );

    return;

  }


  /* すでに接続していたら削除 */

  if (realtimeChannel) {

    supabaseClient.removeChannel(
      realtimeChannel
    );

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
            status === "CHANNEL_ERROR"
          ) {

            console.error(
              "★ Supabase Realtime接続エラー"
            );

          }


          if (
            status === "TIMED_OUT"
          ) {

            console.error(
              "★ Supabase Realtime接続タイムアウト"
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
   Realtime更新
================================================== */

let realtimeUpdating = false;


async function reloadFromSupabase() {

  if (
    realtimeUpdating
  ) {

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
      exportCalendar
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
    .forEach(cell => {

      cell.addEventListener(
        "click",
        e => {

          e.stopPropagation();


          selectedCell =
            cell;


          showShiftMenu(

            cell,

            cell.dataset.staff,

            cell.dataset.date

          );

        }
      );

    });

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
    left + menuWidth >
    window.innerWidth - 10
  ) {

    left =
      rect.left -
      menuWidth -
      6;

  }


  if (left < 10) {

    left = 10;

  }


  let top =
    rect.top;


  const menuHeight =
    menu.offsetHeight ||
    150;


  if (
    top + menuHeight >
    window.innerHeight - 10
  ) {

    top =
      window.innerHeight -
      menuHeight -
      10;

  }


  if (top < 10) {

    top = 10;

  }


  menu.style.position =
    "fixed";


  menu.style.left =
    left + "px";


  menu.style.top =
    top + "px";


  menu.style.zIndex =
    "9999";

}


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


  const name =
    getStaffName(
      staffName
    );


  try {

    /*
      削除
    */

    if (!shiftName) {

      const result =
        await supabaseClient

          .from(
            "work_shifts"
          )

          .delete()

          .eq(
            "staff_name",
            name
          )

          .eq(
            "work_date",
            dateKey
          );


      if (result.error) {
        throw result.error;
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
      既存データ確認
    */

    const existing =
      await supabaseClient

        .from(
          "work_shifts"
        )

        .select(
          "id"
        )

        .eq(
          "staff_name",
          name
        )

        .eq(
          "work_date",
          dateKey
        )
        .maybeSingle();


    if (existing.error) {
      throw existing.error;
    }


    /*
      既存ならUPDATE
    */

    if (existing.data) {

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
            existing.data.id
          );


      if (result.error) {
        throw result.error;
      }

    }

    /*
      なければINSERT
    */

    else {

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
              shiftName

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


  try {

    /*
      編集
    */

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


      /*
        勤務データの職員名も変更
      */

      if (
        oldName !== name
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


        if (workResult.error) {
          throw workResult.error;
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

    /*
      新規
    */

    else {

      const result =
        await supabaseClient

          .from(
            "staff"
          )

          .insert({

            name

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
        "staff-item";


      item.innerHTML = `

        <span>
          ${escapeHtml(name)}
        </span>

        <div>

          <button
            type="button"
            class="edit-staff-button"
          >
            編集
          </button>

          <button
            type="button"
            class="delete-staff-button"
          >
            削除
          </button>

        </div>

      `;


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


            try {

              /*
                勤務データ削除
              */

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


              /*
                職員削除
              */

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


  try {

    /*
      編集
    */

    if (
      editingShiftIndex >= 0
    ) {

      const oldShift =
        appData.shiftTypes[
          editingShiftIndex
        ];


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


      /*
        勤務名を変更した場合
        work_shifts側も変更
      */

      if (
        oldShift.name !== name
      ) {

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

    /*
      新規
    */

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
        "shift-list-item";


      const timeText =

        shift.start &&
        shift.end

          ? `${shift.start} ～ ${shift.end}`

          : "";


      item.innerHTML = `

        <div>

          <strong>
            ${escapeHtml(
              shift.name
            )}
          </strong>

          <div class="shift-time">
            ${escapeHtml(
              timeText
            )}
          </div>

        </div>

        <div>

          <button
            type="button"
            data-edit
          >
            編集
          </button>

          <button
            type="button"
            data-delete
          >
            削除
          </button>

        </div>

      `;


      const editButton =
        item.querySelector(
          "[data-edit]"
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
          "[data-delete]"
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


            try {

              /*
                勤務データからも削除
              */

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


              /*
                勤務形態削除
              */

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
================================================== */

function addCompanyHoliday() {

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
      h =>
        start <= h.end &&
        end >= h.start
    );


  if (overlap) {

    alert(
      "既に登録されている休業期間と重複しています"
    );

    return;

  }


  appData.companyHolidays.push({

    name,

    start,

    end

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


  if (endInput) {

    endInput.value =
      "";

  }


  saveLocalData();

  renderHolidayList();

  renderSchedule();

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
    (holiday, index) => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "holiday-list-item";


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

        <div>

          <strong>
            ${escapeHtml(
              holiday.name
            )}
          </strong>

          <div>
            ${escapeHtml(
              dateText
            )}
          </div>

        </div>

        <button type="button">
          削除
        </button>

      `;


      const button =
        item.querySelector(
          "button"
        );


      if (button) {

        button.addEventListener(
          "click",
          () => {

            appData.companyHolidays.splice(
              index,
              1
            );


            saveLocalData();

            renderHolidayList();

            renderSchedule();

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

function saveAkeTime() {

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


  appData.akeTime = {

    start:
      start.value,

    end:
      end.value

  };


  saveLocalData();


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

    const year =
      currentDate.getFullYear();


    const month =
      currentDate.getMonth() + 1;


    text.textContent =
      `${year}年${month}月の勤務をカレンダー用ファイルとして出力しますか？`;

  }


  modal.style.display =
    "flex";

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
    ).padStart(2, "0") +

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
