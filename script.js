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
   選択状態
================================================== */

let selectedCell = null;

let selectedStaffName = "";

let selectedDateKey = "";

let leaveMenuOpen = false;


/* ==================================================
   その他
================================================== */

let publicHolidays = {};

let realtimeChannel = null;

let realtimeReloadTimer = null;

let autoSyncTimer = null;

let realtimeUpdating = false;

let cloudOperationBusy = false;


/* ==================================================
   起動
================================================== */

document.addEventListener(
  "DOMContentLoaded",
  init
);


/* ==================================================
   初期化
================================================== */

async function init() {

  console.log(
    "★ 勤務表アプリ起動"
  );


  /*
   * まずローカルデータを読み込む
   * Supabaseが失敗しても画面を表示する
   */

  loadLocalData();


  /*
   * イベントを先に登録
   */

  bindEvents();


  /*
   * まず画面を表示
   */

  renderAll();


  /*
   * Supabase
   */

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

      console.log(
        "★ Supabase接続準備完了"
      );


      await loadAllFromSupabase();


      renderAll();


      setupRealtime();

      startAutoSync();

    }

  } catch (error) {

    console.error(
      "Supabase初期化エラー:",
      error
    );

    /*
     * Supabaseが失敗しても
     * アプリ自体はそのまま使用可能
     */

  }


  loadPublicHolidays();


  console.log(
    "★ 初期化完了"
  );

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
      parsed.akeTime || {
        start: "05:30",
        end: "11:15"
      };


  } catch (error) {

    console.error(
      "ローカルデータ読み込みエラー:",
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
      "ローカル保存エラー:",
      error
    );

  }

}


/* ==================================================
   全体描画
================================================== */

function renderAll() {

  renderSchedule();

  renderStaffList();

  renderShiftList();

  renderCompanyHolidayList();

  renderLeaveTypeList();

  renderAkeTime();

}


/* ==================================================
   ページ切り替え
================================================== */

function showPage(pageName) {

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

    leave:
      document.getElementById(
        "leavePage"
      )

  };


  Object.values(pages)
    .forEach(page => {

      if (page) {

        page.style.display =
          "none";

      }

    });


  if (pages[pageName]) {

    pages[pageName].style.display =
      "block";

  }


  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page ===
        pageName
      );

    });


  hideShiftMenu();

  hideLeaveMenu();


  if (pageName === "schedule") {

    renderSchedule();

  }

}

/* ==================================================
   Supabase 全データ取得
================================================== */

async function loadAllFromSupabase() {

  if (!supabaseClient) {

    return;

  }


  /* ================================================
     職員
  ================================================= */

  const staffResult =
    await supabaseClient

      .from("staff")

      .select(
        "id,name,created_at,sort_order,calendar_token"
      );


  if (staffResult.error) {

    throw staffResult.error;

  }


  appData.staff =
    (staffResult.data || [])

      .filter(row =>
        row.name &&
        row.name !== "明"
      )

      .map((row, index) => ({

        id: row.id,

        name:
          String(row.name),

        sort_order:
          row.sort_order !== null
            ? Number(row.sort_order)
            : index,

        calendar_token:
          row.calendar_token || ""

      }))

      .sort((a, b) =>
        Number(a.sort_order) -
        Number(b.sort_order)
      );


  /* ================================================
     勤務形態
  ================================================= */

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


  appData.shiftTypes =
    (shiftResult.data || [])

      .filter(row =>
        row.name &&
        row.name !== "明"
      )

      .map(row => ({

        id: row.id,

        name:
          String(row.name),

        start:
          String(row.start_time || ""),

        end:
          String(row.end_time || ""),

        break:
          String(row.break_time || "")

      }));


  /* ================================================
     勤務・休暇
  ================================================= */

  const workResult =
    await supabaseClient

      .from("work_shifts")

      .select(
        "id,staff_name,work_date,shift_name,leave_type"
      );


  if (workResult.error) {

    throw workResult.error;

  }


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
    .forEach(row => {

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

      } else {

        appData.shifts[
          row.staff_name
        ][
          row.work_date
        ] =
          row.shift_name || "";

      }

    });


  /* ================================================
     休暇種類
  ================================================= */

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
      "休暇種類取得エラー:",
      leaveResult.error
    );

  } else {

    appData.leaveTypes =
      (leaveResult.data || [])
        .map(row => ({

          id: row.id,

          name:
            String(row.name || ""),

          color:
            row.color ||
            "#d9f2df"

        }))
        .filter(row =>
          row.name
        );

  }


  /* ================================================
     休業
  ================================================= */

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


  if (!holidayResult.error) {

    appData.companyHolidays =
      (holidayResult.data || [])
        .map(row => ({

          id: row.id,

          name:
            String(row.name || ""),

          start:
            String(row.start_date || ""),

          end:
            String(
              row.end_date ||
              row.start_date ||
              ""
            )

        }))
        .filter(row =>
          row.name &&
          row.start &&
          row.end
        );

  }


  /* ================================================
     明け時間
  ================================================= */

  const akeResult =
    await supabaseClient

      .from("app_settings")

      .select(
        "setting_name,setting_value"
      );


  if (!akeResult.error) {

    let start =
      "05:30";

    let end =
      "11:15";


    (akeResult.data || [])
      .forEach(row => {

        if (
          row.setting_name ===
          "ake_start"
        ) {

          start =
            row.setting_value ||
            start;

        }


        if (
          row.setting_name ===
          "ake_end"
        ) {

          end =
            row.setting_value ||
            end;

        }

      });


    appData.akeTime = {
      start,
      end
    };

  }


  saveLocalData();

}

/* ==================================================
   イベント登録
================================================== */

function bindEvents() {


  /* ナビ */

  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        function() {

          showPage(
            this.dataset.page
          );

        }
      );

    });


  /* 前月 */

  document
    .getElementById(
      "prevMonth"
    )
    ?.addEventListener(
      "click",
      function() {

        currentDate.setMonth(
          currentDate.getMonth() - 1
        );

        renderSchedule();

      }
    );


  /* 次月 */

  document
    .getElementById(
      "nextMonth"
    )
    ?.addEventListener(
      "click",
      function() {

        currentDate.setMonth(
          currentDate.getMonth() + 1
        );

        renderSchedule();

      }
    );


  /* 職員追加 */

  document
    .getElementById(
      "addStaffButton"
    )
    ?.addEventListener(
      "click",
      addOrUpdateStaff
    );


  /* 勤務追加 */

  document
    .getElementById(
      "addShiftButton"
    )
    ?.addEventListener(
      "click",
      addOrUpdateShift
    );


  /* 休業追加 */

  document
    .getElementById(
      "addCompanyHolidayButton"
    )
    ?.addEventListener(
      "click",
      addCompanyHoliday
    );


  /* 明け時間 */

  document
    .getElementById(
      "saveAkeTimeButton"
    )
    ?.addEventListener(
      "click",
      saveAkeTime
    );


  /* 休暇種類追加 */

  document
    .getElementById(
      "addLeaveButton"
    )
    ?.addEventListener(
      "click",
      addLeaveType
    );


  /* 月消去 */

  document
    .getElementById(
      "deleteMonthButton"
    )
    ?.addEventListener(
      "click",
      deleteCurrentMonth
    );


  /* 年度消去 */

  document
    .getElementById(
      "deleteFiscalYearButton"
    )
    ?.addEventListener(
      "click",
      deleteFiscalYear
    );


  /* カレンダー */

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


  /* 外側タップ */

  document.addEventListener(
    "click",
    function(event) {

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
        shiftMenu.style.display !== "none" &&
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
        leaveMenu.style.display !== "none" &&
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


  if (!table || !title) {

    return;

  }


  const year =
    currentDate.getFullYear();

  const month =
    currentDate.getMonth();


  title.textContent =
    `${year}年${month + 1}月`;


  table.innerHTML = "";


  /* ================================================
     ヘッダー
  ================================================= */

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
    new Date(
      year,
      month + 1,
      0
    ).getDate();


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


    const dateKey =
      dateToKey(date);


    const week =
      date.getDay();


    if (week === 6) {

      th.classList.add(
        "saturday"
      );

    }


    if (week === 0) {

      th.classList.add(
        "sunday"
      );

    }


    if (
      publicHolidays[
        dateKey
      ]
    ) {

      th.classList.add(
        "holiday"
      );

    }


    if (
      isCompanyHoliday(
        dateKey
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
        ${getWeekName(week)}
       </div>`;


    headerRow.appendChild(
      th
    );

  }


  const totalHeader =
    document.createElement(
      "th"
    );


  totalHeader.className =
    "total-header";

  totalHeader.textContent =
    "勤務";


  headerRow.appendChild(
    totalHeader
  );


  thead.appendChild(
    headerRow
  );

  table.appendChild(
    thead
  );


  /* ================================================
     本体
  ================================================= */

  const tbody =
    document.createElement(
      "tbody"
    );


  appData.staff.forEach(
    staff => {

      const tr =
        document.createElement(
          "tr"
        );


      tr.className =
        "staff-row";


      /* 職員名 */

      const staffCell =
        document.createElement(
          "th"
        );


      staffCell.className =
        "staff-cell staff-name-cell";


      staffCell.textContent =
        staff.name;


      staffCell.title =
        "カレンダー登録";


      staffCell.addEventListener(
        "click",
        function(event) {

          event.stopPropagation();

          openCalendarModal(
            staff
          );

        }
      );


      tr.appendChild(
        staffCell
      );


      let workCount = 0;


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
          dateToKey(date);


        const td =
          document.createElement(
            "td"
          );


        td.className =
          "shift-cell";


        const week =
          date.getDay();


        if (week === 6) {

          td.classList.add(
            "saturday"
          );

        }


        if (week === 0) {

          td.classList.add(
            "sunday"
          );

        }


        if (
          publicHolidays[
            dateKey
          ]
        ) {

          td.classList.add(
            "holiday"
          );

        }


        if (
          isCompanyHoliday(
            dateKey
          )
        ) {

          td.classList.add(
            "company-holiday"
          );

        }


        const display =
          getDisplayShift(
            staff.name,
            dateKey
          );


        if (
          display.type ===
          "leave"
        ) {

          td.textContent =
            display.name;

          td.classList.add(
            "leave-cell"
          );

          td.style.backgroundColor =
            display.color;


          workCount++;

        } else {

          td.textContent =
            display.name || "";


          if (
            display.name &&
            display.name !==
            "明"
          ) {

            workCount++;

          }

        }


        td.dataset.staff =
          staff.name;

        td.dataset.date =
          dateKey;


        td.addEventListener(
          "click",
          function(event) {

            event.stopPropagation();


            /*
             * 休暇メニューが開いているときは
             * 別セルを押しても勤務メニューを開かない
             */

            if (
              leaveMenuOpen
            ) {

              return;

            }


            openShiftMenu(
              td,
              staff.name,
              dateKey
            );

          }
        );


        tr.appendChild(
          td
        );

      }


      const totalCell =
        document.createElement(
          "td"
        );


      totalCell.className =
        "total-cell";


      totalCell.textContent =
        workCount;


      tr.appendChild(
        totalCell
      );


      tbody.appendChild(
        tr
      );

    }
  );


  table.appendChild(
    tbody
  );

}


/* ==================================================
   曜日
================================================== */

function getWeekName(day) {

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
   勤務表示取得
================================================== */

function getDisplayShift(
  staffName,
  dateKey
) {

  /*
   * 休暇を最優先
   */

  const leaveName =
    appData.leaves?.[
      staffName
    ]?.[
      dateKey
    ];


  if (leaveName) {

    const leave =
      appData.leaveTypes.find(
        item =>
          item.name ===
          leaveName
      );


    return {

      type: "leave",

      name: leaveName,

      color:
        leave?.color ||
        "#d9f2df"

    };

  }


  /*
   * 通常勤務
   */

  const shift =
    appData.shifts?.[
      staffName
    ]?.[
      dateKey
    ];


  if (shift) {

    return {

      type: "shift",

      name: shift

    };

  }


  /*
   * 前日が宿・夜なら明
   */

  const date =
    keyToDate(
      dateKey
    );


  date.setDate(
    date.getDate() - 1
  );


  const previousKey =
    dateToKey(date);


  const previousShift =
    appData.shifts?.[
      staffName
    ]?.[
      previousKey
    ];


  if (
    previousShift &&
    (
      previousShift.includes("宿") ||
      previousShift.includes("夜")
    )
  ) {

    return {

      type: "shift",

      name: "明"

    };

  }


  return {

    type: "empty",

    name: ""

  };

}


/* ==================================================
   勤務メニュー
================================================== */

function openShiftMenu(
  cell,
  staffName,
  dateKey
) {

  hideLeaveMenu();


  selectedCell =
    cell;

  selectedStaffName =
    staffName;

  selectedDateKey =
    dateKey;


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


  buttons.innerHTML = "";


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
        function(event) {

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
    function(event) {

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
      function(event) {

        event.stopPropagation();

        openLeaveMenu(
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
   休暇メニュー
================================================== */

function openLeaveMenu(
  cell,
  staffName,
  dateKey
) {

  hideShiftMenu();


  selectedCell =
    cell;

  selectedStaffName =
    staffName;

  selectedDateKey =
    dateKey;


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


  buttons.innerHTML = "";


  leaveMenuOpen =
    true;


  /* 休暇種類 */

  appData.leaveTypes.forEach(
    leave => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "shift-menu-button leave-menu-button";


      const color =
        document.createElement(
          "span"
        );


      color.className =
        "leave-menu-color";


      color.style.backgroundColor =
        leave.color ||
        "#d9f2df";


      const text =
        document.createElement(
          "span"
        );


      text.textContent =
        leave.name;


      button.appendChild(
        color
      );

      button.appendChild(
        text
      );


      button.addEventListener(
        "click",
        function(event) {

          event.stopPropagation();

          saveLeave(
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
    function(event) {

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
    function(event) {

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
   メニュー位置
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


  if (
    left + menuWidth >
    window.innerWidth - 8
  ) {

    left =
      window.innerWidth -
      menuWidth -
      8;

  }


  if (
    left < 8
  ) {

    left = 8;

  }


  if (
    top + menuHeight >
    window.innerHeight - 8
  ) {

    top =
      rect.top -
      menuHeight -
      6;

  }


  if (
    top < 8
  ) {

    top = 8;

  }


  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

  menu.style.visibility =
    "visible";

}


/* ==================================================
   勤務メニューを閉じる
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
   休暇メニューを閉じる
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
   通常勤務保存
================================================== */

async function saveWorkShift(
  staffName,
  dateKey,
  shiftName
) {

  hideShiftMenu();


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

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


    renderSchedule();


  } catch (error) {

    console.error(
      "勤務保存エラー:",
      error
    );

    alert(
      "勤務を保存できませんでした。"
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

  hideLeaveMenu();


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

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
                leaveName

            },

            {
              onConflict:
                "staff_name,work_date"
            }

          );


      if (result.error) {

        throw result.error;

      }

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
      leaveName;


    delete appData.shifts[
      staffName
    ][
      dateKey
    ];


    renderSchedule();


  } catch (error) {

    console.error(
      "休暇保存エラー:",
      error
    );

    alert(
      "休暇を保存できませんでした。"
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

  hideShiftMenu();


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

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


    renderSchedule();


  } catch (error) {

    console.error(
      "勤務削除エラー:",
      error
    );

    alert(
      "削除できませんでした。"
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

  hideLeaveMenu();


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

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


    renderSchedule();


  } catch (error) {

    console.error(
      "休暇解除エラー:",
      error
    );

    alert(
      "休暇を解除できませんでした。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   職員追加
================================================== */

async function addOrUpdateStaff() {

  const input =
    document.getElementById(
      "staffNameInput"
    );


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
      "「明」は登録できません。"
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


  cloudOperationBusy =
    true;


  try {

    const sortOrder =
      appData.staff.length;


    let inserted = null;


    if (supabaseClient) {

      const result =
        await supabaseClient

          .from("staff")

          .insert({

            name,

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


      inserted =
        result.data;

    }


    const staff = {

      id:
        inserted?.id ||
        Date.now(),

      name,

      sort_order:
        inserted?.sort_order ??
        sortOrder,

      calendar_token:
        inserted?.calendar_token ||
        ""

    };


    appData.staff.push(
      staff
    );


    appData.shifts[name] =
      {};

    appData.leaves[name] =
      {};


    input.value =
      "";


    renderAll();


  } catch (error) {

    console.error(
      "職員追加エラー:",
      error
    );

    alert(
      "職員を追加できませんでした。"
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


  list.innerHTML = "";


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


      edit.type =
        "button";

      edit.className =
        "list-button";

      edit.textContent =
        "編集";


      edit.addEventListener(
        "click",
        () =>
          editStaff(index)
      );


      const remove =
        document.createElement(
          "button"
        );


      remove.type =
        "button";

      remove.className =
        "list-button delete";

      remove.textContent =
        "削除";


      remove.addEventListener(
        "click",
        () =>
          deleteStaff(staff)
      );


      buttons.appendChild(
        edit
      );

      buttons.appendChild(
        remove
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
   職員編集
================================================== */

async function editStaff(index) {

  const staff =
    appData.staff[index];


  if (!staff) {

    return;

  }


  const newName =
    prompt(
      "職員名を入力してください。",
      staff.name
    );


  if (
    newName === null
  ) {

    return;

  }


  const name =
    newName.trim();


  if (!name) {

    return;

  }


  if (
    name === staff.name
  ) {

    return;

  }


  if (
    name === "明"
  ) {

    alert(
      "「明」は登録できません。"
    );

    return;

  }


  if (
    appData.staff.some(
      item =>
        item.name === name
    )
  ) {

    alert(
      "同じ名前があります。"
    );

    return;

  }


  const oldName =
    staff.name;


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

      const staffUpdate =
        await supabaseClient

          .from("staff")

          .update({
            name
          })

          .eq(
            "id",
            staff.id
          );


      if (
        staffUpdate.error
      ) {

        throw staffUpdate.error;

      }


      /*
       * 勤務データも名前変更
       */

      const workResult =
        await supabaseClient

          .from("work_shifts")

          .select(
            "id,work_date,shift_name,leave_type"
          )

          .eq(
            "staff_name",
            oldName
          );


      if (
        workResult.error
      ) {

        throw workResult.error;

      }


      for (
        const row
        of workResult.data || []
      ) {

        await supabaseClient

          .from("work_shifts")

          .update({
            staff_name:
              name
          })

          .eq(
            "id",
            row.id
          );

      }

    }


    staff.name =
      name;


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


    renderAll();


  } catch (error) {

    console.error(
      "職員編集エラー:",
      error
    );

    alert(
      "職員名を変更できませんでした。"
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
  staff
) {

  if (
    !confirm(
      `${staff.name}を削除しますか？`
    )
  ) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "staff_name",
          staff.name
        );


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

    }


    appData.staff =
      appData.staff.filter(
        item =>
          item.id !== staff.id
      );


    delete appData.shifts[
      staff.name
    ];

    delete appData.leaves[
      staff.name
    ];


    renderAll();


  } catch (error) {

    console.error(
      "職員削除エラー:",
      error
    );

    alert(
      "職員を削除できませんでした。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

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
    breakInput.value;


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
      "同じ勤務形態名があります。"
    );

    return;

  }


  cloudOperationBusy =
    true;


  try {

    let inserted = null;


    if (supabaseClient) {

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

          })

          .select(
            "id,name,start_time,end_time,break_time"
          )

          .single();


      if (result.error) {

        throw result.error;

      }


      inserted =
        result.data;

    }


    appData.shiftTypes.push({

      id:
        inserted?.id ||
        Date.now(),

      name,

      start,

      end,

      break:
        breakTime

    });


    nameInput.value = "";
    startInput.value = "";
    endInput.value = "";
    breakInput.value = "";


    renderAll();


  } catch (error) {

    console.error(
      "勤務形態追加エラー:",
      error
    );

    alert(
      "勤務形態を追加できませんでした。"
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


  list.innerHTML = "";


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


      let text = "";


      if (
        shift.start ||
        shift.end
      ) {

        text =
          `${shift.start || "--:--"} ～ ${shift.end || "--:--"}`;

      }


      if (shift.break) {

        text +=
          `　休憩 ${shift.break}分`;

      }


      sub.textContent =
        text;


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


      edit.type =
        "button";

      edit.className =
        "list-button";

      edit.textContent =
        "編集";


      edit.onclick =
        () =>
          editShift(index);


      const remove =
        document.createElement(
          "button"
        );


      remove.type =
        "button";

      remove.className =
        "list-button delete";

      remove.textContent =
        "削除";


      remove.onclick =
        () =>
          deleteShift(shift);


      buttons.appendChild(
        edit
      );

      buttons.appendChild(
        remove
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
   勤務形態編集
================================================== */

async function editShift(index) {

  const shift =
    appData.shiftTypes[index];


  if (!shift) {

    return;

  }


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


  if (newName === "明") {

    alert(
      "「明」は登録できません。"
    );

    return;

  }


  const start =
    prompt(
      "開始時間（例 08:30）",
      shift.start || ""
    );


  if (start === null) {

    return;

  }


  const end =
    prompt(
      "終了時間（例 17:30）",
      shift.end || ""
    );


  if (end === null) {

    return;

  }


  const breakTime =
    prompt(
      "休憩時間（分）",
      shift.break || ""
    );


  if (breakTime === null) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

      const result =
        await supabaseClient

          .from("shift_types")

          .update({

            name:
              newName,

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


      if (result.error) {

        throw result.error;

      }

    }


    shift.name =
      newName;

    shift.start =
      start;

    shift.end =
      end;

    shift.break =
      breakTime;


    renderAll();


  } catch (error) {

    console.error(
      "勤務編集エラー:",
      error
    );

    alert(
      "勤務形態を変更できませんでした。"
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
  shift
) {

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

    if (supabaseClient) {

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

    }


    appData.shiftTypes =
      appData.shiftTypes.filter(
        item =>
          item.id !== shift.id
      );


    renderAll();


  } catch (error) {

    console.error(
      "勤務削除エラー:",
      error
    );

    alert(
      "勤務形態を削除できませんでした。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   休暇種類追加
================================================== */

async function addLeaveType() {

  const nameInput =
    document.getElementById(
      "leaveNameInput"
    );

  const colorInput =
    document.getElementById(
      "leaveColorInput"
    );


  const name =
    nameInput.value.trim();


  const color =
    colorInput.value ||
    "#d9f2df";


  if (!name) {

    alert(
      "休暇名を入力してください。"
    );

    return;

  }


  if (
    appData.leaveTypes.some(
      leave =>
        leave.name === name
    )
  ) {

    alert(
      "同じ休暇種類が登録されています。"
    );

    return;

  }


  cloudOperationBusy =
    true;


  try {

    let inserted = null;


    if (supabaseClient) {

      const result =
        await supabaseClient

          .from("leave_types")

          .insert({

            name,

            color

          })

          .select(
            "id,name,color"
          )

          .single();


      if (result.error) {

        throw result.error;

      }


      inserted =
        result.data;

    }


    appData.leaveTypes.push({

      id:
        inserted?.id ||
        Date.now(),

      name,

      color

    });


    nameInput.value = "";


    renderAll();


  } catch (error) {

    console.error(
      "休暇種類追加エラー:",
      error
    );

    alert(
      "休暇種類を追加できませんでした。"
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


  if (!list) {

    return;

  }


  list.innerHTML = "";


  if (
    appData.leaveTypes.length === 0
  ) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "list-item";


    empty.textContent =
      "休暇種類がまだ登録されていません。";


    list.appendChild(
      empty
    );


    return;

  }


  appData.leaveTypes.forEach(
    leave => {

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


      const color =
        document.createElement(
          "span"
        );


      color.className =
        "leave-type-color";


      color.style.backgroundColor =
        leave.color;


      title.appendChild(
        color
      );


      const text =
        document.createElement(
          "span"
        );


      text.textContent =
        ` ${leave.name}`;


      title.appendChild(
        text
      );


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


      edit.type =
        "button";

      edit.className =
        "list-button";

      edit.textContent =
        "編集";


      edit.onclick =
        () =>
          editLeaveType(
            leave
          );


      const remove =
        document.createElement(
          "button"
        );


      remove.type =
        "button";

      remove.className =
        "list-button delete";

      remove.textContent =
        "削除";


      remove.onclick =
        () =>
          deleteLeaveType(
            leave
          );


      buttons.appendChild(
        edit
      );

      buttons.appendChild(
        remove
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
   休暇種類編集
================================================== */

async function editLeaveType(
  leave
) {

  const name =
    prompt(
      "休暇名",
      leave.name
    );


  if (name === null) {

    return;

  }


  const newName =
    name.trim();


  if (!newName) {

    return;

  }


  const color =
    prompt(
      "色を入力してください。\n例：#d9f2df",
      leave.color
    );


  if (color === null) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

      const result =
        await supabaseClient

          .from("leave_types")

          .update({

            name:
              newName,

            color:
              color

          })

          .eq(
            "id",
            leave.id
          );


      if (result.error) {

        throw result.error;

      }


      /*
       * 既に登録されている休暇にも
       * 名前変更を反映
       */

      await supabaseClient

        .from("work_shifts")

        .update({
          leave_type:
            newName
        })

        .eq(
          "leave_type",
          leave.name
        );

    }


    const oldName =
      leave.name;


    leave.name =
      newName;

    leave.color =
      color;


    Object.keys(
      appData.leaves
    )
      .forEach(
        staffName => {

          const dates =
            appData.leaves[
              staffName
            ];


          Object.keys(
            dates
          )
            .forEach(
              dateKey => {

                if (
                  dates[dateKey] ===
                  oldName
                ) {

                  dates[dateKey] =
                    newName;

                }

              }
            );

        }
      );


    renderAll();


  } catch (error) {

    console.error(
      "休暇種類編集エラー:",
      error
    );

    alert(
      "休暇種類を変更できませんでした。"
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
  leave
) {

  if (
    !confirm(
      `${leave.name}を削除しますか？`
    )
  ) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

      /*
       * この休暇が使われている勤務データを削除
       */

      const used =
        await supabaseClient

          .from("work_shifts")

          .delete()

          .eq(
            "leave_type",
            leave.name
          );


      if (used.error) {

        throw used.error;

      }


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

    }


    appData.leaveTypes =
      appData.leaveTypes.filter(
        item =>
          item.id !== leave.id
      );


    Object.keys(
      appData.leaves
    )
      .forEach(
        staffName => {

          delete appData.leaves[
            staffName
          ];

        }
      );


    /*
     * 再読み込みすると
     * 削除した休暇だけ消える
     */

    if (supabaseClient) {

      await loadAllFromSupabase();

    }


    renderAll();


  } catch (error) {

    console.error(
      "休暇種類削除エラー:",
      error
    );

    alert(
      "休暇種類を削除できませんでした。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   明け時間表示
================================================== */

function renderAkeTime() {

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
    startInput.value ||
    "05:30";


  const end =
    endInput.value ||
    "11:15";


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

      await saveSetting(
        "ake_start",
        start
      );


      await saveSetting(
        "ake_end",
        end
      );

    }


    appData.akeTime = {

      start,

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
      "明け時間を保存できませんでした。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   設定保存
================================================== */

async function saveSetting(
  name,
  value
) {

  const existing =
    await supabaseClient

      .from("app_settings")

      .select("setting_name")

      .eq(
        "setting_name",
        name
      )
      .maybeSingle();


  if (existing.error) {

    throw existing.error;

  }


  if (existing.data) {

    const result =
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


    if (result.error) {

      throw result.error;

    }

  } else {

    const result =
      await supabaseClient

        .from("app_settings")

        .insert({

          setting_name:
            name,

          setting_value:
            value

        });


    if (result.error) {

      throw result.error;

    }

  }

}


/* ==================================================
   休業登録
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


  cloudOperationBusy =
    true;


  try {

    let inserted = null;


    if (supabaseClient) {

      const result =
        await supabaseClient

          .from("company_holidays")

          .insert({

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


      inserted =
        result.data;

    }


    appData.companyHolidays.push({

      id:
        inserted?.id ||
        Date.now(),

      name,

      start,

      end

    });


    nameInput.value = "";
    startInput.value = "";
    endInput.value = "";


    renderAll();


  } catch (error) {

    console.error(
      "休業登録エラー:",
      error
    );

    alert(
      "休業を登録できませんでした。"
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


  list.innerHTML = "";


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
        `${holiday.start} ～ ${holiday.end}`;


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


      edit.type =
        "button";

      edit.className =
        "list-button";

      edit.textContent =
        "編集";


      edit.onclick =
        () =>
          editCompanyHoliday(
            holiday
          );


      const remove =
        document.createElement(
          "button"
        );


      remove.type =
        "button";

      remove.className =
        "list-button delete";

      remove.textContent =
        "削除";


      remove.onclick =
        () =>
          deleteCompanyHoliday(
            holiday
          );


      buttons.appendChild(
        edit
      );

      buttons.appendChild(
        remove
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
      "開始日 YYYY-MM-DD",
      holiday.start
    );


  if (start === null) {

    return;

  }


  const end =
    prompt(
      "終了日 YYYY-MM-DD",
      holiday.end
    );


  if (end === null) {

    return;

  }


  cloudOperationBusy =
    true;


  try {

    if (supabaseClient) {

      const result =
        await supabaseClient

          .from("company_holidays")

          .update({

            name:
              name.trim(),

            start_date:
              start,

            end_date:
              end || start

          })

          .eq(
            "id",
            holiday.id
          );


      if (result.error) {

        throw result.error;

      }

    }


    holiday.name =
      name.trim();

    holiday.start =
      start;

    holiday.end =
      end || start;


    renderAll();


  } catch (error) {

    console.error(
      "休業編集エラー:",
      error
    );

    alert(
      "休業設定を変更できませんでした。"
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

    if (supabaseClient) {

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

    }


    appData.companyHolidays =
      appData.companyHolidays.filter(
        item =>
          item.id !== holiday.id
      );


    renderAll();


  } catch (error) {

    console.error(
      "休業削除エラー:",
      error
    );

    alert(
      "休業を削除できませんでした。"
    );

  } finally {

    cloudOperationBusy =
      false;

  }

}


/* ==================================================
   会社休業判定
================================================== */

function isCompanyHoliday(
  dateKey
) {

  return appData.companyHolidays
    .some(
      holiday =>
        dateKey >= holiday.start &&
        dateKey <= holiday.end
    );

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
      "現在表示している月の勤務・休暇をカレンダー用ファイルとして作成します。";

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
   カレンダー用ICS作成
================================================== */

function subscribeStaffCalendar() {

  const staffName =
    selectedStaffName;


  if (!staffName) {

    closeCalendarModal();

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


  const lines = [

    "BEGIN:VCALENDAR",

    "VERSION:2.0",

    "PRODID:-//勤務表//JP",

    "CALSCALE:GREGORIAN",

    "METHOD:PUBLISH"

  ];


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


    const display =
      getDisplayShift(
        staffName,
        dateKey
      );


    if (!display.name) {

      continue;

    }


    const next =
      new Date(date);

    next.setDate(
      next.getDate() + 1
    );


    const nextKey =
      formatICSDate(next);


    const title =
      display.type === "leave"

        ? `休暇：${display.name}`

        : `勤務：${display.name}`;


    lines.push(
      "BEGIN:VEVENT"
    );


    lines.push(
      `DTSTART;VALUE=DATE:${formatICSDate(date)}`
    );


    lines.push(
      `DTEND;VALUE=DATE:${nextKey}`
    );


    lines.push(
      `SUMMARY:${escapeICS(title)}`
    );


    lines.push(
      `UID:${staffName}-${dateKey}@workschedule`
    );


    lines.push(
      "END:VEVENT"
    );

  }


  lines.push(
    "END:VCALENDAR"
  );


  const blob =
    new Blob(
      [
        lines.join("\r\n")
      ],
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
    `勤務表_${staffName}_${year}-${String(month + 1).padStart(2,"0")}.ics`;


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
   ICS日付
================================================== */

function formatICSDate(
  date
) {

  return (

    String(
      date.getFullYear()
    ) +

    String(
      date.getMonth() + 1
    ).padStart(2,"0") +

    String(
      date.getDate()
    ).padStart(2,"0")

  );

}


/* ==================================================
   ICS文字
================================================== */

function escapeICS(
  text
) {

  return String(text)

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
   日付キー → Date
================================================== */

function keyToDate(
  key
) {

  const parts =
    key.split("-");


  return new Date(

    Number(parts[0]),

    Number(parts[1]) - 1,

    Number(parts[2])

  );

}


/* ==================================================
   公休日取得
================================================== */

async function loadPublicHolidays() {

  try {

    const response =
      await fetch(
        "https://holidays-jp.github.io/api/v1/date.json"
      );


    if (!response.ok) {

      return;

    }


    publicHolidays =
      await response.json();


    renderSchedule();


  } catch (error) {

    console.warn(
      "祝日取得失敗:",
      error
    );

  }

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

      console.warn(error);

    }

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
          table: "company_holidays"
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


      .subscribe(
        status => {

          console.log(
            "Realtime:",
            status
          );

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
      reloadFromSupabase,
      500
    );

}


/* ==================================================
   Supabase再読込
================================================== */

async function reloadFromSupabase() {

  if (
    !supabaseClient ||
    cloudOperationBusy ||
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
      "自動同期エラー:",
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

          reloadFromSupabase();

        }

      },
      10000
    );

}


/* ==================================================
   共通
================================================== */

function isValidColor(
  value
) {

  const option =
    new Option();


  option.style.color =
    value;


  return (
    option.style.color !== ""
  );

}

