const STORAGE_KEY = "workScheduleAppData";

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

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadData();
  bindEvents();
  renderAll();
  loadPublicHolidays();
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      appData = {
        staff: Array.isArray(parsed.staff)
          ? parsed.staff
          : [],

        shiftTypes: Array.isArray(parsed.shiftTypes)
          ? parsed.shiftTypes
          : [],

        companyHolidays: Array.isArray(parsed.companyHolidays)
          ? parsed.companyHolidays
          : [],

        shifts: parsed.shifts || {},

        akeTime: parsed.akeTime || {
          start: "05:30",
          end: "11:15"
        }
      };
    }
  } catch (e) {
    console.error("データ読み込みエラー", e);
  }
}

function saveData() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(appData)
  );
}

/* =========================
   イベント
========================= */

function bindEvents() {

  document.querySelectorAll(".nav-button").forEach(button => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });

  const prev =
    document.getElementById("prevMonth");

  const next =
    document.getElementById("nextMonth");

  if (prev) {
    prev.addEventListener("click", () => {
      currentDate.setMonth(
        currentDate.getMonth() - 1
      );

      renderSchedule();
    });
  }

  if (next) {
    next.addEventListener("click", () => {
      currentDate.setMonth(
        currentDate.getMonth() + 1
      );

      renderSchedule();
    });
  }

  const addStaff =
    document.getElementById("addStaffButton");

  if (addStaff) {
    addStaff.addEventListener(
      "click",
      addOrUpdateStaff
    );
  }

  const addShift =
    document.getElementById("addShiftButton");

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

  document.addEventListener("click", e => {

    const menu =
      document.getElementById("shiftMenu");

    if (!menu) return;

    if (
      !menu.contains(e.target) &&
      !e.target.closest(".schedule-cell")
    ) {
      hideShiftMenu();
    }
  });
}

/* =========================
   ページ切り替え
========================= */

function showPage(page) {

  document.querySelectorAll(".page").forEach(p => {
    p.style.display = "none";
  });

  const target =
    document.getElementById(
      page + "Page"
    );

  if (target) {
    target.style.display = "";
  }

  document.querySelectorAll(".nav-button").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.page === page
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

/* =========================
   全体描画
========================= */

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

/* =========================
   日付
========================= */

function getDateKey(
  year,
  month,
  day
) {

  return `${year}-${String(month).padStart(
    2,
    "0"
  )}-${String(day).padStart(
    2,
    "0"
  )}`;
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

function formatDateJP(dateKey) {

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

/* =========================
   休業・祝日
========================= */

function isCompanyHoliday(dateKey) {

  return appData.companyHolidays.some(h => {

    return (
      dateKey >= h.start &&
      dateKey <= h.end
    );

  });
}

function getCompanyHoliday(dateKey) {

  return appData.companyHolidays.find(h => {

    return (
      dateKey >= h.start &&
      dateKey <= h.end
    );

  });
}

function isPublicHoliday(dateKey) {

  return !!publicHolidays[dateKey];
}

/* =========================
   勤務表示
========================= */

function getStoredShift(
  staffName,
  dateKey
) {

  if (!appData.shifts[staffName]) {
    return "";
  }

  return (
    appData.shifts[staffName][dateKey] ||
    ""
  );
}

function setStoredShift(
  staffName,
  dateKey,
  shiftName
) {

  if (!appData.shifts[staffName]) {

    appData.shifts[staffName] = {};
  }

  if (shiftName) {

    appData.shifts[staffName][dateKey] =
      shiftName;

  } else {

    delete appData.shifts[staffName][dateKey];
  }
}

/* =========================
   自動「明」
========================= */

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
    new Date(current);

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

/* =========================
   勤務表
========================= */

function renderSchedule() {

  const table =
    document.getElementById(
      "scheduleTable"
    );

  const monthLabel =
    document.getElementById(
      "currentMonth"
    );

  if (!table) return;

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
    ==================================================
    職員列・日付列・集計列の基本幅
    ==================================================
  */

const staffColumnWidth = 90;

  const dateColumnWidth =
    window.innerWidth <= 600
      ? 48
      : 52;

  const totalColumnWidth =
    window.innerWidth <= 600
      ? 52
      : 58;

  /*
    ==================================================
    テーブルHTML
    ==================================================
  */

  let html = "";

  /*
    ★重要

    colgroupで列幅をテーブル構造として
    先に確定させる。

    これにより、

    ・勤務形態0件
    ・勤務形態1件
    ・勤務形態が複数件

    でも職員名部分の位置・幅が
    テーブル計算に引っ張られにくくなる。
  */

  html += "<colgroup>";

  /*
    職員列
  */

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

  /*
    日付列
  */

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

  /*
    集計列
  */

  appData.shiftTypes.forEach(() => {

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
  });

  html += "</colgroup>";

  /* =========================
     THEAD
  ========================= */

  html += "<thead>";

  html += "<tr>";

  /*
    職員
  */

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

  /*
    日付
  */

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
      isCompanyHoliday(dateKey)
    ) {

      cls +=
        " company-holiday";

    } else if (
      week === 0 ||
      isPublicHoliday(dateKey)
    ) {

      cls += " sunday";

    } else if (
      week === 6
    ) {

      cls += " saturday";
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

  /*
    勤務形態ごとの集計
  */

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

  html += "</tr>";

  /* =========================
     THEAD 2行目
  ========================= */

  html += "<tr>";

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
      `;

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
          累計
        </th>
      `;
    }
  );

  html += "</tr>";

  html += "</thead>";

  /* =========================
     TBODY
  ========================= */

  html += "<tbody>";

  appData.staff.forEach(
    staffName => {

      /*
        ★職員1人分の行
      */

      html += `
        <tr
          class="staff-row"
          data-staff-row="${escapeHtml(
            staffName
          )}"
          style="
            width:100%;
          "
        >
      `;

      /*
        ★職員名セル

        行の左端に固定する。
      */

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

      /* =========================
         日付
      ========================= */

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

          cls += " sunday";

        } else if (
          week === 6
        ) {

          cls += " saturday";
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

      /* =========================
         集計
      ========================= */

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
          `;

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
              ${fiscal}
            </td>
          `;
        }
      );

      html += "</tr>";
    }
  );

  html += "</tbody>";

  /*
    ==================================================
    テーブル自体
    ==================================================
  */

  table.style.borderCollapse =
    "separate";

  table.style.borderSpacing =
    "0";

  /*
    ★重要

    autoではなくfixedにする。

    colgroupで指定した幅を
    テーブルレイアウトに使わせる。
  */

  table.style.tableLayout =
    "fixed";

  /*
    テーブルの必要幅

    職員列
    ＋ 日付列
    ＋ 集計列
  */

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

  /*
    ★テーブルは必要幅を維持

    画面より大きければ
    table-wrapper側で横スクロールする。
  */

  table.style.width =
    requiredTableWidth + "px";

  table.style.minWidth =
    requiredTableWidth + "px";

  table.style.maxWidth =
    "none";

  /*
    HTMLを反映
  */

  table.innerHTML =
    html;

  /*
    ==================================================
    描画後の職員列固定
    ==================================================
  */

  const staffHeaders =
    table.querySelectorAll(
      ".staff-header"
    );

  staffHeaders.forEach(cell => {

    cell.style.width =
      staffColumnWidth + "px";

    cell.style.minWidth =
      staffColumnWidth + "px";

    cell.style.maxWidth =
      staffColumnWidth + "px";

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

  const staffCells =
    table.querySelectorAll(
      ".staff-name-cell"
    );

  staffCells.forEach(cell => {

    cell.style.width =
      staffColumnWidth + "px";

    cell.style.minWidth =
      staffColumnWidth + "px";

    cell.style.maxWidth =
      staffColumnWidth + "px";

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

  /*
    ★職員行そのものも確認
  */

  

  bindScheduleCells();
  bindStaffNameCells();
}

/* =========================
   勤務セル
========================= */

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

/* =========================
   職員名
========================= */

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

/* =========================
   勤務メニュー
========================= */

function showShiftMenu(
  cell,
  staffName,
  dateKey
) {

  const menu =
    document.getElementById(
      "shiftMenu"
    );

  if (!menu) return;

  const buttons =
    document.getElementById(
      "shiftMenuButtons"
    );

  if (!buttons) return;

  buttons.innerHTML = "";

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
        e => {

          e.stopPropagation();

          setStoredShift(
            staffName,
            dateKey,
            shift.name
          );

          saveData();

          renderSchedule();

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
    e => {

      e.stopPropagation();

      setStoredShift(
        staffName,
        dateKey,
        ""
      );

      saveData();

      renderSchedule();

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
    menuWidth + "px";

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
    menu.offsetHeight || 150;

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

/* =========================
   月間集計
========================= */

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

/* =========================
   年度集計
========================= */

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

    if (
      y === startYear &&
      month < 4
    ) {

      endMonth =
        12;
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

  /* 1〜3月 */

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

/* =========================
   職員
========================= */

function addOrUpdateStaff() {

  const input =
    document.getElementById(
      "staffNameInput"
    );

  if (!input) return;

  const name =
    input.value.trim();

  if (!name) {

    alert(
      "職員名を入力してください"
    );

    return;
  }

  if (name === "明") {

    alert(
      "「明」は職員名に使用できません"
    );

    return;
  }

  if (
    appData.staff.some(
      (s, i) =>
        s === name &&
        i !== editingStaffIndex
    )
  ) {

    alert(
      "同じ職員名は登録できません"
    );

    return;
  }

  if (
    editingStaffIndex >= 0
  ) {

    const oldName =
      appData.staff[
        editingStaffIndex
      ];

    appData.staff[
      editingStaffIndex
    ] = name;

    if (
      appData.shifts[oldName]
    ) {

      appData.shifts[name] =
        appData.shifts[
          oldName
        ];

      delete appData.shifts[
        oldName
      ];
    }

    editingStaffIndex =
      -1;

    input.value = "";

    const button =
      document.getElementById(
        "addStaffButton"
      );

    if (button) {
      button.textContent =
        "職員を追加";
    }

  } else {

    appData.staff.push(
      name
    );

    input.value = "";
  }

  saveData();

  renderStaffList();

  renderSchedule();
}

function renderStaffList() {

  const list =
    document.getElementById(
      "staffList"
    );

  if (!list) return;

  list.innerHTML = "";

  appData.staff.forEach(
    (name, index) => {

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
            class="list-button"
            data-edit
          >
            編集
          </button>

          <button
            type="button"
            class="list-button delete"
            data-delete
          >
            削除
          </button>

        </div>
      `;

      /* 編集 */

      item
        .querySelector(
          "[data-edit]"
        )
        .addEventListener(
          "click",
          () => {

            const input =
              document.getElementById(
                "staffNameInput"
              );

            if (input) {

              input.value =
                name;

              input.focus();
            }

            editingStaffIndex =
              index;

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

      /* 削除 */

      item
        .querySelector(
          "[data-delete]"
        )
        .addEventListener(
          "click",
          () => {

            if (
              !confirm(
                `${name}を削除しますか？`
              )
            ) {
              return;
            }

            delete appData.shifts[
              name
            ];

            appData.staff.splice(
              index,
              1
            );

            saveData();

            renderStaffList();

            renderSchedule();
          }
        );

      list.appendChild(
        item
      );
    }
  );
}

/* =========================
   勤務形態
========================= */

function addOrUpdateShift() {

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

  if (!nameInput) return;

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

  if (
    appData.shiftTypes.some(
      (s, i) =>
        s.name === name &&
        i !== editingShiftIndex
    )
  ) {

    alert(
      "同じ勤務形態名は登録できません"
    );

    return;
  }

  if (
    editingShiftIndex >= 0
  ) {

    const oldName =
      appData.shiftTypes[
        editingShiftIndex
      ].name;

    appData.shiftTypes[
      editingShiftIndex
    ] = {
      name,
      start,
      end,
      break: breakTime
    };

    if (
      oldName !== name
    ) {

      Object.keys(
        appData.shifts
      ).forEach(
        staff => {

          Object.keys(
            appData.shifts[
              staff
            ]
          ).forEach(
            date => {

              if (
                appData.shifts[
                  staff
                ][date] ===
                oldName
              ) {

                appData.shifts[
                  staff
                ][date] =
                  name;
              }
            }
          );
        }
      );
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

  } else {

    appData.shiftTypes.push({
      name,
      start,
      end,
      break: breakTime
    });
  }

  nameInput.value = "";

  if (startInput) {
    startInput.value = "";
  }

  if (endInput) {
    endInput.value = "";
  }

  if (breakInput) {
    breakInput.value = "";
  }

  saveData();

  renderShiftList();

  renderSchedule();
}

function renderShiftList() {

  const list =
    document.getElementById(
      "shiftList"
    );

  if (!list) return;

  list.innerHTML = "";

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

      item
        .querySelector(
          "[data-edit]"
        )
        .addEventListener(
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
                shift.start ||
                "";
            }

            if (endInput) {

              endInput.value =
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
          "[data-delete]"
        )
        .addEventListener(
          "click",
          () => {

            if (
              !confirm(
                `${shift.name}を削除しますか？`
              )
            ) {
              return;
            }

            appData.shiftTypes.splice(
              index,
              1
            );

            saveData();

            renderShiftList();

            renderSchedule();
          }
        );

      list.appendChild(
        item
      );
    }
  );
}

/* =========================
   休業設定
========================= */

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

  nameInput.value = "";

  startInput.value = "";

  if (endInput) {
    endInput.value = "";
  }

  saveData();

  renderHolidayList();

  renderSchedule();
}

function renderHolidayList() {

  const list =
    document.getElementById(
      "companyHolidayList"
    );

  if (!list) return;

  list.innerHTML = "";

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

      item
        .querySelector(
          "button"
        )
        .addEventListener(
          "click",
          () => {

            appData.companyHolidays.splice(
              index,
              1
            );

            saveData();

            renderHolidayList();

            renderSchedule();
          }
        );

      list.appendChild(
        item
      );
    }
  );
}

/* =========================
   明け時間
========================= */

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
    start: start.value,
    end: end.value
  };

  saveData();

  alert(
    "明け時間を保存しました"
  );
}

/* =========================
   カレンダー
========================= */

function openCalendarConfirm(
  staffName
) {

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

  if (!modal) return;

  modal.dataset.staff =
    staffName;

  if (title) {

    title.textContent =
      `${staffName}の勤務表`;
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

function exportCalendar() {

  const modal =
    document.getElementById(
      "calendarConfirm"
    );

  if (!modal) return;

  const staffName =
    modal.dataset.staff;

  if (!staffName) return;

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
      shiftName === "休み"
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
      shiftName === "明"
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

function getOtherStaffDescription(
  currentStaff,
  dateKey
) {

  const lines = [];

  appData.staff.forEach(
    staff => {

      if (
        staff ===
        currentStaff
      ) {
        return;
      }

      const shift =
        getDisplayShift(
          staff,
          dateKey
        );

      if (shift) {

        lines.push(
          `${staff}: ${shift}`
        );
      }
    }
  );

  return lines.join(
    "\\n"
  );
}

/* =========================
   月削除
========================= */

function deleteCurrentMonth() {

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

  const days =
    getDaysInMonth(
      year,
      month
    );

  appData.staff.forEach(
    staff => {

      if (
        !appData.shifts[
          staff
        ]
      ) {
        return;
      }

      for (
        let day = 1;
        day <= days;
        day++
      ) {

        const key =
          getDateKey(
            year,
            month,
            day
          );

        delete appData.shifts[
          staff
        ][key];
      }
    }
  );

  saveData();

  renderSchedule();
}

/* =========================
   年度削除
========================= */

function deleteFiscalYear() {

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

  appData.staff.forEach(
    staff => {

      if (
        !appData.shifts[
          staff
        ]
      ) {
        return;
      }

      Object.keys(
        appData.shifts[
          staff
        ]
      ).forEach(
        key => {

          const [
            y,
            m
          ] =
            key
              .split("-")
              .map(Number);

          const fiscalYear =
            m >= 4
              ? y
              : y - 1;

          if (
            fiscalYear ===
            fiscalStart
          ) {

            delete appData.shifts[
              staff
            ][key];
          }
        }
      );
    }
  );

  saveData();

  renderSchedule();
}

/* =========================
   公休日API
========================= */

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

/* =========================
   エスケープ
========================= */

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
