/* ==================================================
   Supabase
================================================== */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

let supabaseClient = null;

/* ==================================================
   現在の職場
================================================== */

let currentOrganization =
  null;


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


/*
   保存中にRealtime通知が来た場合、

   以前：
   「保存中だからreturn」
   → 通知を捨てる

   今回：
   「保存後に再読み込みする」
   → 通知を取りこぼさない
*/

let realtimeReloadPending =
  false;


/* ==================================================
   メニュー状態
================================================== */

let shiftMenuMode =
  "shift";


/* ==================================================
   固定ヘッダー
================================================== */

let scheduleFixedHeader =
  null;

let scheduleFixedHeaderTable =
  null;

let scheduleFixedStaffColumn =
  null;

let scheduleFixedStaffTable =
  null;


/* ==================================================
   初期化
================================================== */

document.addEventListener("DOMContentLoaded", init);
async function init() {

  try {

    console.log("★ 勤務表アプリ起動");


    if (
      !window.supabase ||
      typeof window.supabase.createClient !== "function"
    ) {

      throw new Error(
        "Supabaseライブラリが読み込まれていません"
      );

    }


    supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        experimental: {
          passkey: true
        }
      }
    }
  );


    console.log(
      "★ Supabase初期化完了"
    );


    const {
      data: { session },
      error
    } =
      await supabaseClient.auth.getSession();


    if (error) {

      throw error;

    }

         /*
     * =========================================
     * 明示的にログアウトした直後か確認
     * =========================================
     *
     * Supabaseのセッションが残っていても、
     * 「ログアウトした」という操作を優先して
     * ログイン画面を表示する。
     */

    const forceLoginScreen =
      sessionStorage.getItem(
        "forceLoginScreen"
      );


    if (
      forceLoginScreen === "true"
    ) {

      console.log(
        "★ 明示的なログアウト後なのでログイン画面を表示します"
      );


      /*
       * 念のためSupabaseセッションも完全にログアウト
       */

      await supabaseClient.auth.signOut({
        scope: "global"
      });


      sessionStorage.removeItem(
        "forceLoginScreen"
      );


      showLoginPage();


      setupGoogleLogin();


      setupPasskeyLogin();


      setupNewOrganizationButton();


      return;

    }


    /*
     * =========================================
     * Googleログイン前
     * =========================================
     */

        if (!session) {

      console.log(
        "Googleログインが必要です"
      );


      showLoginPage();


      setupGoogleLogin();


      setupPasskeyLogin();


      setupNewOrganizationButton();


      return;

    }


    /*
     * =========================================
     * Googleログイン済み
     * =========================================
     */

    console.log(
      "Googleログイン済み",
      session.user.email
    );

     const pendingOrganizationName =
  sessionStorage.getItem(
    "pendingOrganizationName"
  );

const pendingStaffName =
  sessionStorage.getItem(
    "pendingStaffName"
  );


if (
  pendingOrganizationName &&
  pendingStaffName
) {

  console.log(
    "★ 新規職場登録を再開します"
  );

  console.log(
    "職場名：",
    pendingOrganizationName
  );

  console.log(
    "登録者名：",
    pendingStaffName
  );


  // 二重実行を防ぐため先に削除
  sessionStorage.removeItem(
    "pendingOrganizationName"
  );

  sessionStorage.removeItem(
    "pendingStaffName"
  );


  try {

    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        "create_organization_and_admin",
        {
          new_org_name:
            pendingOrganizationName,

          new_staff_name:
            pendingStaffName
        }
      );

    if (error) {
      throw error;
    }

    if (
      !data ||
      !data.length
    ) {
      throw new Error(
        "職場の登録結果を取得できませんでした。"
      );
    }

    const result =
      data[0];


    currentOrganization = {

      id:
        result.organization_id,

      name:
        result.organization_name,

      role:
        "admin"

    };


    alert(
      `${result.organization_name}を登録しました。\n\n` +
      `${result.staff_name}さんを登録者として職員管理に登録しました。`
    );

  } catch (error) {

    console.error(
      "Googleログイン後の職場登録エラー",
      error
    );

    alert(
      "職場の登録に失敗しました。\n\n" +
      (error?.message ||
        String(error))
    );

    showLoginPage(
      "職場の登録に失敗しました。"
    );

    setupGoogleLogin();

    setupNewOrganizationButton();

    return;
  }

}


    /*
     * =========================================
     * 招待URLの確認
     * =========================================
     */

    const inviteToken =
      new URLSearchParams(
        window.location.search
      ).get("invite");


    if (inviteToken) {

      console.log(
        "★ 招待ログインを処理します"
      );


      const inviteAccepted =
        await handleInviteAfterLogin();


      if (!inviteAccepted) {

        showLoginPage(
          "招待リンクの登録に失敗しました。"
        );


        return;

      }

    }


    /*
     * =========================================
     * 所属職場を取得
     * =========================================
     */

    const organization =
      await getCurrentOrganization(
        session.user.id
      );


    if (!organization) {

      showLoginPage(
        "ログインしましたが、職場への所属がありません。"
      );


      return;

    }


    currentOrganization =
      organization;


    console.log(
      "所属職場",
      organization
    );

         /*
     * =========================================
     * Passkey登録
     * =========================================
     */

    await registerCurrentUserPasskey();

     setupOrganizationDangerZone();

    /*
     * =========================================
     * アプリ表示
     * =========================================
     */

    showApp();


    loadLocalData();


    bindEvents();


    setupLogoutButton();


    /*
     * =========================================
     * Supabaseデータ読み込み
     * =========================================
     */

    try {

      await loadAllFromSupabase();

    } catch (error) {

      console.error(
        "Supabaseデータ取得失敗",
        error
      );


      alert(
        "Supabaseからデータを取得できませんでした。\n" +
        "現在の画面を表示します。"
      );

    }


    /*
     * =========================================
     * 画面描画
     * =========================================
     */

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

  alert(
    "アプリの初期化に失敗しました。\n\n" +
    "エラー内容：\n" +
    (error?.message || String(error))
  );

  showLoginPage(
    "アプリの初期化に失敗しました。"
  );

  /* ログインボタンを再び有効にする */
  setupGoogleLogin();
}

}

/* ==================================================
   Passkeyログイン
================================================== */

/*
 * Passkeyログインボタンを設定
 */
function setupPasskeyLogin() {

  const button =
    document.getElementById(
      "passkeyLoginButton"
    );

  if (!button) {
    console.log(
      "Passkeyログインボタンが見つかりません"
    );
    return;
  }


  /*
   * この端末・ブラウザが
   * WebAuthn / Passkeyに対応していない場合
   */
  if (
    !window.PublicKeyCredential
  ) {

    console.log(
      "この端末・ブラウザはPasskeyに対応していません"
    );

    button.style.display =
      "none";

    return;

  }


  /*
   * Passkeyボタンを表示
   */

  button.style.display =
    "flex";

  button.disabled =
    false;

  button.style.opacity =
    "1";


  /*
   * クリック処理
   */

  button.onclick =
    async function() {

      await loginWithPasskey();

    };

}


/*
 * Passkeyでログイン
 */
async function loginWithPasskey() {

  const button =
    document.getElementById(
      "passkeyLoginButton"
    );

  const message =
    document.getElementById(
      "loginMessage"
    );


  /*
   * 二重クリック防止
   */

  if (button) {

    button.disabled =
      true;

    button.style.opacity =
      "0.6";

    button.innerHTML =
      '<span style="font-size:20px;">🔐</span>' +
      '認証しています…';

  }


  if (message) {

    message.textContent =
      "Face ID・指紋などで認証してください…";

  }


  try {

    console.log(
      "★ Passkeyログイン開始"
    );


    /*
     * ログアウト後の
     * 強制ログイン画面フラグを解除
     */

    sessionStorage.removeItem(
      "forceLoginScreen"
    );


    /*
     * Supabase Passkeyログイン
     */

    const {
      data,
      error
    } =
      await supabaseClient.auth
        .signInWithPasskey();


    if (error) {

      throw error;

    }


    /*
     * セッション確認
     */

    if (
      !data ||
      !data.session
    ) {

      throw new Error(
        "Passkeyログインに成功しましたが、ログインセッションを取得できませんでした。"
      );

    }


    console.log(
      "★ Passkeyログイン成功",
      data.user?.email
    );


    /*
     * ログイン成功
     *
     * init()をもう一度実行して、
     * 通常のログイン処理を行う
     */

    window.location.reload();


  } catch (error) {

    console.error(
      "Passkeyログインエラー",
      error
    );


    const errorMessage =
      error?.message ||
      String(error);


    /*
     * キャンセルの場合は
     * エラー表示を出しすぎない
     */

    const lowerMessage =
      errorMessage.toLowerCase();


    if (
      !lowerMessage.includes(
        "cancel"
      ) &&
      !lowerMessage.includes(
        "abort"
      )
    ) {

      alert(
        "Face ID / 指紋ログインに失敗しました。\n\n" +
        errorMessage
      );

    }


    if (message) {

      message.textContent =
        "Face ID / 指紋でログインできます。";

    }


    /*
     * ボタンを元に戻す
     */

    if (button) {

      button.disabled =
        false;

      button.style.opacity =
        "1";

      button.innerHTML =
        '<span style="font-size:20px;">🔐</span>' +
        'Face ID / 指紋でログイン';

    }

  }

}

 /* ==================================================
    Passkey登録
 ================================================== */

/*
 * 現在ログインしているユーザーに
 * Passkeyを登録する
 */
async function registerCurrentUserPasskey() {

  try {

    /*
     * Passkey対応確認
     */
    if (
      !window.PublicKeyCredential
    ) {

      console.log(
        "この端末・ブラウザはPasskeyに対応していません"
      );

      return;

    }


    /*
     * 現在のログイン状態を確認
     */
    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();


    if (!session) {

      console.log(
        "ログインしていないためPasskey登録を行いません"
      );

      return;

    }


    /*
     * すでにPasskeyが登録されているか確認
     */
    const {
      data: passkeys,
      error: listError
    } =
      await supabaseClient.auth.passkey.list();


    if (listError) {

      console.error(
        "Passkey一覧取得エラー",
        listError
      );

      return;

    }


    /*
     * すでに登録済みなら何もしない
     */
    if (
      passkeys &&
      passkeys.length > 0
    ) {

      console.log(
        "★ Passkeyはすでに登録されています"
      );

      return;

    }


    /*
     * Passkey登録を確認
     */
    const register =
      confirm(
        "次回から、Face ID・指紋などで\n" +
        "勤務表にログインできるようにしますか？\n\n" +
        "この端末にPasskeyを登録します。"
      );


    if (!register) {

      console.log(
        "Passkey登録はキャンセルされました"
      );

      return;

    }


    /*
     * Passkey登録開始
     */
    console.log(
      "★ Passkey登録開始"
    );


    const {
      data,
      error
    } =
      await supabaseClient.auth
        .registerPasskey();


    if (error) {

      throw error;

    }


    console.log(
      "★ Passkey登録完了",
      data
    );


    alert(
      "Face ID / 指紋ログインの登録が完了しました。\n\n" +
      "次回からログイン画面で\n" +
      "「Face ID / 指紋でログイン」\n" +
      "を利用できます。"
    );


  } catch (error) {

    console.error(
      "Passkey登録エラー",
      error
    );


    const errorMessage =
      error?.message ||
      String(error);


    /*
     * ユーザーがFace ID等を
     * キャンセルした場合は
     * エラー画面を出さない
     */

    const lowerMessage =
      errorMessage.toLowerCase();


    if (
      !lowerMessage.includes(
        "cancel"
      ) &&
      !lowerMessage.includes(
        "abort"
      )
    ) {

      alert(
        "Face ID / 指紋ログインの登録に失敗しました。\n\n" +
        errorMessage
      );

    }

  }

}

async function issueStaffInvite(staffId) {

  try {

    const { data, error } =
      await supabaseClient.rpc(
        "issue_staff_invite",
        {
          target_staff_id: staffId
        }
      );


    if (error) {

      console.error(
        "招待発行エラー",
        error
      );

      alert(
        "招待リンクの発行に失敗しました。\n\n" +
        error.message
      );

      return;

    }


    if (
      !data ||
      !data.length ||
      !data[0].token
    ) {

      alert(
        "招待リンクを作成できませんでした。"
      );

      return;

    }


    const token =
      data[0].token;


    const inviteUrl =
      window.location.origin +
      window.location.pathname +
      "?invite=" +
      encodeURIComponent(token);


    /* ==================================================
       招待リンクをコピー
    ================================================== */

    try {

      await navigator.clipboard.writeText(
        inviteUrl
      );


      alert(
        "招待リンクをコピーしました。\n\n" +
        "このリンクを職員本人に送ってください。"
      );


    } catch (clipboardError) {

      console.warn(
        "クリップボードへのコピーに失敗しました",
        clipboardError
      );


      /* ==================================================
         iPhoneなどでコピーできない場合
      ================================================== */

      window.prompt(
        "招待リンクをコピーしてください。",
        inviteUrl
      );

    }


    console.log(
      "招待リンク",
      inviteUrl
    );


  } catch (error) {

    console.error(
      "招待リンク発行エラー",
      error
    );


    alert(
      "招待リンクの発行に失敗しました。\n\n" +
      (error?.message ||
        String(error))
    );

  }

}


/* ==================================================
   ログイン画面表示
================================================== */

function showLoginPage(
  message = ""
) {

  const loginPage =
    document.getElementById(
      "loginPage"
    );


  const app =
    document.getElementById(
      "app"
    );


  const loginMessage =
    document.getElementById(
      "loginMessage"
    );


  if (loginPage) {

    loginPage.style.display =
      "flex";

  }


  if (app) {

    app.style.display =
      "none";

  }


  if (loginMessage) {

    loginMessage.textContent =
      message;

  }

}

async function logout() {

  console.log("★ ログアウト開始");

  try {

    // まず現在のセッションを確認
    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    console.log(
      "★ 現在のセッション：",
      session
    );

    // セッションがすでにない場合
    if (!session) {

      console.log(
        "★ セッションがありません。ログアウト済みとして処理します。"
      );

      currentOrganization = null;

      showLoginPage(
        "ログアウトしました。"
      );

      setupGoogleLogin();

      return;
    }


    // セッションがある場合だけsignOut
    const { error } =
      await supabaseClient.auth.signOut();


    if (error) {

      console.error(
        "★ Supabaseログアウトエラー",
        error
      );

      // Auth session missing は
      // すでにログアウト済みとして扱う
      if (
        String(error.message).includes(
          "Auth session missing"
        )
      ) {

        currentOrganization = null;

        showLoginPage(
          "ログアウトしました。"
        );

        setupGoogleLogin();

        return;
      }

      throw error;

    }


    console.log(
      "★ Supabaseログアウト成功"
    );

    currentOrganization = null;

    showLoginPage(
      "ログアウトしました。"
    );

    setupGoogleLogin();


  } catch (error) {

    console.error(
      "★ ログアウト処理エラー",
      error
    );

    alert(
      "ログアウトに失敗しました。\n\n" +
      "エラー：" +
      error.message
    );

  }

}

function setupLogoutButton() {

  const button =
    document.getElementById("logoutButton");

  if (!button) {
    return;
  }

  button.onclick = async function() {

    const confirmed =
      confirm(
        "ログアウトしますか？"
      );

    if (!confirmed) {
      return;
    }

    try {

      console.log("★ ログアウト開始");

       sessionStorage.setItem(
  "forceLoginScreen",
  "true"
);

      /*
       * 現在の職場情報を消す
       */

      currentOrganization = null;


      /*
       * アプリ内のローカルデータを消す
       */

      localStorage.removeItem(
        STORAGE_KEY
      );


      /*
       * 新規職場登録途中の情報も消す
       */

      sessionStorage.removeItem(
        "pendingOrganizationName"
      );

      sessionStorage.removeItem(
        "pendingStaffName"
      );


      /*
       * Supabaseのログインセッションを
       * 完全にログアウト
       */

      const {
        error
      } =
        await supabaseClient.auth.signOut({
          scope: "global"
        });


      if (error) {
        throw error;
      }


      console.log(
        "★ Supabaseログアウト完了"
      );


      /*
       * 念のため、現在のセッションが
       * 本当に消えているか確認
       */

      const {
        data: {
          session
        }
      } =
        await supabaseClient.auth.getSession();


      if (session) {

        console.warn(
          "⚠️ セッションが残っています"
        );

      } else {

        console.log(
          "★ セッション完全消去確認"
        );

      }


      /*
       * ログイン画面へ戻す
       */

      showLoginPage(
  ""
);


/*
 * ログイン関連ボタンを再設定
 */

setupGoogleLogin();

setupPasskeyLogin();

setupNewOrganizationButton();


    } catch (error) {

      console.error(
        "ログアウトエラー",
        error
      );

      alert(
        "ログアウトに失敗しました。\n\n" +
        (
          error?.message ||
          String(error)
        )
      );

    }

  };

}

/* =========================================================
   職場完全削除
   ========================================================= */

/* ---------------------------------------------------------
   職場完全削除ボタンの表示設定
   --------------------------------------------------------- */

function setupOrganizationDangerZone() {

  const dangerZone =
    document.getElementById(
      "organizationDangerZone"
    );

  const deleteButton =
    document.getElementById(
      "deleteOrganizationButton"
    );

  if (!dangerZone || !deleteButton) {
    return;
  }

  /*
   * 管理者だけ表示
   */

  const isAdmin =
    currentOrganization &&
    currentOrganization.role === "admin";

  if (!isAdmin) {

    dangerZone.style.display = "none";

    return;
  }

  dangerZone.style.display = "block";

  /*
   * クリック処理
   */

  deleteButton.onclick =
    async function() {

      await deleteCurrentOrganization();

    };

}


/* ---------------------------------------------------------
   職場完全削除
   --------------------------------------------------------- */

async function deleteCurrentOrganization() {

  if (!currentOrganization) {

    alert(
      "現在の職場情報を取得できません。"
    );

    return;
  }


  /*
   * 管理者チェック
   */

  if (
    currentOrganization.role !== "admin"
  ) {

    alert(
      "管理者のみ職場を削除できます。"
    );

    return;
  }


  /*
   * 職場名
   */

  const organizationName =
    currentOrganization.name;


  /*
   * 1回目の確認
   */

  const firstConfirm =
    confirm(
      "【重要】\n\n" +
      "この職場を完全に削除します。\n\n" +
      "削除されるもの：\n" +
      "・勤務表\n" +
      "・職員\n" +
      "・勤務形態\n" +
      "・休暇設定\n" +
      "・休業設定\n" +
      "・職場設定\n" +
      "・招待情報\n" +
      "・この職場に紐づくアプリのログインアカウント\n\n" +
      "この操作は元に戻せません。\n\n" +
      "本当に削除しますか？"
    );


  if (!firstConfirm) {
    return;
  }


  /*
   * 職場名を入力してもらう
   */

  const confirmationName =
    prompt(
      "削除を実行するには、\n" +
      "職場名をそのまま入力してください。\n\n" +
      "職場名：\n" +
      organizationName
    );


  /*
   * キャンセル
   */

  if (confirmationName === null) {
    return;
  }


  /*
   * 職場名確認
   */

  if (
    confirmationName.trim() !==
    organizationName
  ) {

    alert(
      "職場名が一致しません。\n\n" +
      "職場の削除を中止しました。"
    );

    return;
  }


  /*
   * 最終確認
   */

  const finalConfirm =
    confirm(
      "最終確認です。\n\n" +
      "「" +
      organizationName +
      "」を完全に削除します。\n\n" +
      "本当に実行しますか？"
    );


  if (!finalConfirm) {
    return;
  }


  /*
   * ボタンを無効化
   */

  const deleteButton =
    document.getElementById(
      "deleteOrganizationButton"
    );

  if (deleteButton) {

    deleteButton.disabled = true;

    deleteButton.textContent =
      "削除しています…";

    deleteButton.style.opacity =
      "0.6";

  }


  cloudOperationBusy = true;


  try {

    /*
     * 現在のログインセッション確認
     */

    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();


    if (!session) {

      throw new Error(
        "ログイン情報を取得できませんでした。"
      );

    }


    /*
     * Edge Functionを呼び出す
     */

    const response =
      await fetch(
        SUPABASE_URL +
        "/functions/v1/delete-organization-completely",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              "Bearer " +
              session.access_token
          },

          body: JSON.stringify({

            organization_id:
              currentOrganization.id,

            confirmation_name:
              confirmationName.trim()

          })

        }
      );


    /*
     * レスポンス取得
     */

    const result =
      await response.json();


    /*
     * エラー
     */

    if (!response.ok) {

      throw new Error(
        result?.error ||
        "職場の削除に失敗しました。"
      );

    }


    if (!result?.success) {

      throw new Error(
        result?.error ||
        "職場の削除結果を確認できませんでした。"
      );

    }


    console.log(
      "職場完全削除完了",
      result
    );


    /*
     * ローカルデータを削除
     */

    localStorage.removeItem(
      STORAGE_KEY
    );


    /*
     * 現在の職場情報をクリア
     */

    currentOrganization = null;


    /*
     * Supabaseログアウト
     *
     * Edge Function側で現在ユーザーの
     * Authアカウントが削除された場合も、
     * ここでローカルセッションを消します。
     */

    try {

      await supabaseClient.auth.signOut();

    } catch (signOutError) {

      console.warn(
        "ログアウト処理",
        signOutError
      );

    }


    /*
     * 完了メッセージ
     */

    alert(
      "「" +
      organizationName +
      "」を完全に削除しました。\n\n" +
      "ログイン画面に戻ります。"
    );


    /*
     * ログイン画面へ
     */

    showLoginPage(
      "職場を削除しました。"
    );


    /*
     * Googleログイン・新規登録ボタンを再設定
     */

    setupGoogleLogin();

    setupNewOrganizationButton();


  } catch (error) {

    console.error(
      "職場完全削除エラー",
      error
    );


    alert(
      "職場の削除に失敗しました。\n\n" +
      (
        error?.message ||
        String(error)
      )
    );


  } finally {

    finishCloudOperation();


    /*
     * エラーだった場合は
     * ボタンを元に戻す
     */

    if (deleteButton) {

      deleteButton.disabled = false;

      deleteButton.textContent =
        "職場を完全に削除";

      deleteButton.style.opacity =
        "1";

    }

  }

}

/* ==================================================
   勤務表アプリ表示
================================================== */

function showApp() {

  const loginPage =
    document.getElementById(
      "loginPage"
    );


  const app =
    document.getElementById(
      "app"
    );


  if (loginPage) {

    loginPage.style.display =
      "none";

  }


  if (app) {

    app.style.display =
      "";

   setupOrganizationDangerZone();

  }


  /* =====================================================
     管理者かどうか
  ===================================================== */

  const isAdmin =
    currentOrganization &&
    currentOrganization.role === "admin";


  /* =====================================================
     ナビゲーション
  ===================================================== */

  document
    .querySelectorAll(
      ".nav-button"
    )
    .forEach(
      button => {

        const page =
          button.dataset.page;

        if (
          isAdmin ||
          page === "schedule"
        ) {

          button.style.display =
            "";

        } else {

          button.style.display =
            "none";

        }

      }
    );


  /* =====================================================
     月消去・年度消去
  ===================================================== */

  const deleteMonthButton =
    document.getElementById(
      "deleteMonthButton"
    );


  const deleteFiscalYearButton =
    document.getElementById(
      "deleteFiscalYearButton"
    );


  if (deleteMonthButton) {

    deleteMonthButton.style.display =
      isAdmin
        ? ""
        : "none";

  }


  if (deleteFiscalYearButton) {

    deleteFiscalYearButton.style.display =
      isAdmin
        ? ""
        : "none";

  }


  /* =====================================================
     職員の場合は必ず勤務表を表示
  ===================================================== */

  if (!isAdmin) {

    showPage(
      "schedule"
    );

  }

}



/* ==================================================
   Googleログイン設定
================================================== */

async function loginWithGoogle() {

  const button =
    document.getElementById(
      "googleLoginButton"
    );

     /*
   * Googleログインを開始したので、
   * ログアウト後の強制ログイン画面フラグを解除
   */

  sessionStorage.removeItem(
    "forceLoginScreen"
  );


  const message =
    document.getElementById(
      "loginMessage"
    );


  if (button) {

    button.disabled = true;
    button.style.opacity = "0.6";

  }


  if (message) {

    message.textContent =
      "Googleログイン画面を開いています…";

  }


  try {

    /*
      招待リンクのトークンを取得
    */
    const inviteToken =
      new URLSearchParams(
        window.location.search
      ).get("invite");


    /*
      通常ログインなら通常のURLへ戻す
      招待ログインなら invite を付けたまま戻す
    */
    let redirectUrl =
      "https://mya24950-dotcom.github.io/kinmu-app/";


    if (inviteToken) {

      redirectUrl +=
        "?invite=" +
        encodeURIComponent(
          inviteToken
        );

    }


    const { error } =
      await supabaseClient.auth.signInWithOAuth({
        provider: "google",

        options: {

          redirectTo:
            redirectUrl

        }

      });


    if (error) {

      throw error;

    }


  } catch (error) {

    console.error(
      "Googleログインエラー",
      error
    );


    if (message) {

      message.textContent =
        "Googleログインに失敗しました。";

    }


    if (button) {

      button.disabled = false;
      button.style.opacity = "1";

    }

  }

}

function setupGoogleLogin() {

  const button =
    document.getElementById("googleLoginButton");

  if (!button) {
    console.log("Googleログインボタンが見つかりません");
    return;
  }

  button.disabled = false;
  button.style.opacity = "1";

  button.onclick = function () {

    console.log("★ Googleログインボタンが押されました");

    loginWithGoogle();

  };

}

async function createNewOrganization() {

  const organizationNameInput =
    document.getElementById(
      "organizationNameInput"
    );

  const staffNameInput =
    document.getElementById(
      "organizationStaffNameInput"
    );

  const organizationName =
    organizationNameInput
      ? organizationNameInput.value.trim()
      : "";

  const staffName =
    staffNameInput
      ? staffNameInput.value.trim()
      : "";

  if (!organizationName) {
    alert("職場名を入力してください。");
    organizationNameInput?.focus();
    return;
  }

  if (!staffName) {
    alert("登録者名を入力してください。");
    staffNameInput?.focus();
    return;
  }

  try {

    // まだGoogleログインしていない場合
    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();

    if (!session) {

      sessionStorage.setItem(
        "pendingOrganizationName",
        organizationName
      );

      sessionStorage.setItem(
        "pendingStaffName",
        staffName
      );

      console.log(
        "★ 職場名を保存",
        organizationName
      );

      console.log(
        "★ 登録者名を保存",
        staffName
      );

      // Googleログインへ
      await loginWithGoogle();

      return;
    }


    // すでにログイン済みならそのまま登録
    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        "create_organization_and_admin",
        {
          new_org_name:
            organizationName,

          new_staff_name:
            staffName
        }
      );

    if (error) {
      throw error;
    }

    if (
      !data ||
      !data.length
    ) {
      throw new Error(
        "職場の登録結果を取得できませんでした。"
      );
    }

    const result =
      data[0];

    currentOrganization = {
      id:
        result.organization_id,

      name:
        result.organization_name,

      role:
        "admin"
    };

    alert(
      `${result.organization_name}を登録しました。\n\n` +
      `${result.staff_name}さんを登録者として職員管理に登録しました。`
    );

    showApp();

    loadLocalData();

    bindEvents();

    setupLogoutButton();

    await loadAllFromSupabase();

    renderAll();

    loadPublicHolidays();

    setupRealtime();

    startAutoSync();

    setupVisibilitySync();

  } catch (error) {

    console.error(
      "職場新規登録エラー",
      error
    );

    alert(
      "職場の登録に失敗しました。\n\n" +
      (error?.message ||
        String(error))
    );

  }

}

/* =================================================
   新規職場登録画面
================================================= */

/* =================================================
   新規職場登録画面
================================================= */

function setupNewOrganizationButton() {

  const newOrganizationButton =
    document.getElementById(
      "newOrganizationButton"
    );

  const loginMainView =
    document.getElementById(
      "loginMainView"
    );

  const newOrganizationForm =
    document.getElementById(
      "newOrganizationForm"
    );

  const cancelOrganizationButton =
    document.getElementById(
      "cancelOrganizationButton"
    );

  const organizationNameInput =
    document.getElementById(
      "organizationNameInput"
    );

  const organizationStaffNameInput =
    document.getElementById(
      "organizationStaffNameInput"
    );

  const createOrganizationButton =
    document.getElementById(
      "createOrganizationButton"
    );


  if (
    !newOrganizationButton ||
    !loginMainView ||
    !newOrganizationForm
  ) {
    return;
  }


  /* -----------------------------------------
     新規登録画面を開く
  ----------------------------------------- */

  newOrganizationButton.onclick =
    function() {

      loginMainView.style.display =
        "none";

      newOrganizationForm.style.display =
        "";

      if (organizationNameInput) {

        organizationNameInput.value =
          "";

      }

      if (organizationStaffNameInput) {

        organizationStaffNameInput.value =
          "";

      }

      if (organizationNameInput) {

        organizationNameInput.focus();

      }

    };


  /* -----------------------------------------
     戻る
  ----------------------------------------- */

  if (cancelOrganizationButton) {

    cancelOrganizationButton.onclick =
      function() {

        newOrganizationForm.style.display =
          "none";

        loginMainView.style.display =
          "";

        if (organizationNameInput) {

          organizationNameInput.value =
            "";

        }

        if (organizationStaffNameInput) {

          organizationStaffNameInput.value =
            "";

        }

      };

  }


  /* -----------------------------------------
     職場を登録する
  ----------------------------------------- */

  if (createOrganizationButton) {

    createOrganizationButton.onclick =
      function() {

        createNewOrganization();

      };

  }

}

async function handleInviteAfterLogin() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const inviteToken =
    params.get("invite");


  if (!inviteToken) {

    return false;

  }


  console.log(
    "★ 招待リンクを検出しました"
  );


  try {

    const { data, error } =
      await supabaseClient.rpc(
        "accept_staff_invite",
        {
  target_invite_token:
    inviteToken
}
      );


    if (error) {

      console.error(
        "招待受け入れエラー",
        error
      );


      alert(
        "招待リンクの登録に失敗しました。\n\n" +
        error.message
      );


      return false;

    }


    if (
      !data ||
      !data.length
    ) {

      alert(
        "招待リンクの登録結果を取得できませんでした。"
      );


      return false;

    }


    const result =
      data[0];


    console.log(
      "★ 招待受け入れ成功",
      result
    );


    alert(
      `${result.staff_name}さんとして登録しました。`
    );


    /*
      招待トークンをURLから削除
    */
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );


    return true;


  } catch (error) {

    console.error(
      "招待受け入れ処理エラー",
      error
    );


    alert(
      "招待リンクの処理に失敗しました。\n\n" +
      error.message
    );


    return false;

  }

}

/* ==================================================
   現在の職場を取得
================================================== */

async function getCurrentOrganization(
  userId
) {

  if (!supabaseClient) {

    throw new Error(
      "Supabaseが初期化されていません"
    );

  }


  const {
    data,
    error
  } =
    await supabaseClient

      .from(
        "organization_members"
      )

      .select(
        `
          organization_id,
          role,
          organizations (
            id,
            name,
            created_at
          )
        `
      )

      .eq(
        "user_id",
        userId
      )

      .limit(1);
   
  if (error) {

    console.error(
      "職場情報取得エラー",
      error
    );

    throw error;

  }


  if (
    !data ||
    data.length === 0
  ) {

    return null;

  }


  const member =
    data[0];


  if (
    !member.organizations
  ) {

    return null;

  }


  return {

    id:
      member.organizations.id,

    name:
      member.organizations.name,

    created_at:
      member.organizations.created_at,

    role:
      member.role

  };

}

/* ==================================================
   ログイン中の職員IDを取得
================================================== */

async function getCurrentStaffId() {

  if (!supabaseClient) {
    return null;
  }

  if (!currentOrganization) {
    return null;
  }

  const {
    data: {
      user
    }
  } =
    await supabaseClient.auth.getUser();

  if (!user) {
    return null;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("organization_members")
      .select("staff_id")
      .eq(
        "organization_id",
        currentOrganization.id
      )
      .eq(
        "user_id",
        user.id
      )
      .not(
        "staff_id",
        "is",
        null
      )
      .limit(1);

  if (error) {

    console.error(
      "ログイン中の職員情報取得エラー",
      error
    );

    return null;
  }

  if (
    !data ||
    data.length === 0
  ) {

    return null;
  }

  return data[0].staff_id;
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
        "Realtime旧チャンネル削除エラー",
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


      /* -----------------------------------------------
         職員
      ------------------------------------------------ */

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


      /* -----------------------------------------------
         勤務
      ------------------------------------------------ */

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


      /* -----------------------------------------------
         勤務形態
      ------------------------------------------------ */

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


      /* -----------------------------------------------
         休暇
      ------------------------------------------------ */

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


      /* -----------------------------------------------
         休業
      ------------------------------------------------ */

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


      /* -----------------------------------------------
         明け時間
      ------------------------------------------------ */

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings"
        },
        payload => {

          console.log(
            "Realtime app_settings:",
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

            console.warn(
              "Realtime接続エラー。再接続します。"
            );


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
   Realtime更新予約
================================================== */

function scheduleRealtimeReload() {

  /*
    保存中でも通知を捨てない
  */

  if (
    cloudOperationBusy
  ) {

    realtimeReloadPending =
      true;

    console.log(
      "Realtime更新を保留しました"
    );

    return;

  }


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


  /*
    保存中の場合は保留
  */

  if (
    cloudOperationBusy
  ) {

    realtimeReloadPending =
      true;

    return;

  }


  if (
    realtimeUpdating
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


    console.log(
      "★ Supabaseデータを画面へ反映しました"
    );

  } catch (error) {

    console.error(
      "自動更新エラー",
      error
    );

  } finally {

    realtimeUpdating =
      false;


    /*
      更新中にさらに通知が来た場合
    */

    if (
      realtimeReloadPending &&
      !cloudOperationBusy
    ) {

      realtimeReloadPending =
        false;


      scheduleRealtimeReload();

    }

  }

}


/* ==================================================
   保存完了後のRealtime処理
================================================== */

function finishCloudOperation() {

  cloudOperationBusy =
    false;


  if (
    realtimeReloadPending
  ) {

    realtimeReloadPending =
      false;


    /*
      自分自身の保存後にも
      Supabaseから最新状態を取得する。

      これにより

      端末Aで保存
      ↓
      Supabase保存
      ↓
      端末AもSupabaseから再取得
      ↓
      他端末もRealtimeで取得

      という流れになる。
    */

    setTimeout(
      () => {

        reloadFromSupabase();

      },
      100
    );

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

          /*
            10秒同期でも保存中は
            次回に回す
          */

          realtimeReloadPending =
            true;

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
   画面復帰時同期
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

  /* =====================================================
     職員は「勤務表」以外を開けない
  ===================================================== */

  const isAdmin =
    currentOrganization &&
    currentOrganization.role === "admin";

  if (
    !isAdmin &&
    page !== "schedule"
  ) {

    page = "schedule";

  }


  /* =====================================================
     ページ表示切り替え
  ===================================================== */

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


  /* =====================================================
     ナビボタンの active
  ===================================================== */

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


  /* =====================================================
     ページごとの表示処理
  ===================================================== */

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
   集計用勤務形態正規化
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
   合計列用勤務形態一覧
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
   休暇一覧表示
================================================== */

function renderLeaveLegend() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (!table) {

    return;

  }


  let legend =
    document.getElementById(
      "leaveLegend"
    );


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


    if (
      table.parentElement
    ) {

      table.parentElement.insertBefore(
        legend,
        table.nextSibling
      );

    }

  }


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


  /* ==================================================
     列幅
  ================================================== */

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

        z-index:300;

        background:#f2f2f7;

        box-sizing:border-box;

        border-right:1px solid #d1d1d6;
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
     職員
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

            z-index:200;

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
         日付
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


  /* ==================================================
     テーブル設定
  ================================================== */

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


  /* ==================================================
     HTML反映
  ================================================== */

  table.innerHTML =
    html;


  /* ==================================================
     イベント
  ================================================== */

  bindScheduleCells();

  bindStaffNameCells();


  /* ==================================================
     休暇一覧
  ================================================== */

  renderLeaveLegend();


  /* ==================================================
     固定ヘッダー
  ================================================== */

  updateScheduleFixedLayers();

}


/* =========================================================
   固定レイヤー作成
========================================================= */

function createScheduleFixedLayers() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (!table) {

    return;

  }


  const thead =
    table.querySelector(
      "thead"
    );


  const tbody =
    table.querySelector(
      "tbody"
    );


  const wrapper =
    table.closest(
      ".table-wrapper"
    );


  if (
    !thead ||
    !wrapper
  ) {

    return;

  }


  /* ==================================================
     既存削除
  ================================================== */

  if (
    scheduleFixedHeader
  ) {

    scheduleFixedHeader.remove();

    scheduleFixedHeader =
      null;

    scheduleFixedHeaderTable =
      null;

  }


  if (
    scheduleFixedStaffColumn
  ) {

    scheduleFixedStaffColumn.remove();

    scheduleFixedStaffColumn =
      null;

    scheduleFixedStaffTable =
      null;

  }


  /* ==================================================
     固定ヘッダー
  ================================================== */

  const fixedHeader =
    document.createElement(
      "div"
    );


  fixedHeader.id =
    "scheduleFixedHeader";


  fixedHeader.style.position =
    "fixed";


  fixedHeader.style.display =
    "none";


  fixedHeader.style.overflow =
    "hidden";


  fixedHeader.style.margin =
    "0";


  fixedHeader.style.padding =
    "0";


  fixedHeader.style.background =
    "#f8f8fa";


  fixedHeader.style.zIndex =
    "999";


  fixedHeader.style.pointerEvents =
    "none";


  fixedHeader.style.boxSizing =
    "border-box";


  const fixedHeaderTable =
    document.createElement(
      "table"
    );


  fixedHeaderTable.style.borderCollapse =
    "separate";


  fixedHeaderTable.style.borderSpacing =
    "0";


  fixedHeaderTable.style.tableLayout =
    "fixed";


  fixedHeaderTable.style.margin =
    "0";


  fixedHeaderTable.style.padding =
    "0";


  fixedHeaderTable.style.position =
    "relative";


  const originalColgroup =
    table.querySelector(
      "colgroup"
    );


  if (originalColgroup) {

    fixedHeaderTable.appendChild(
      originalColgroup.cloneNode(
        true
      )
    );

  }


  const fixedThead =
    thead.cloneNode(
      true
    );


  fixedHeaderTable.appendChild(
    fixedThead
  );


  fixedHeader.appendChild(
    fixedHeaderTable
  );


  document.body.appendChild(
    fixedHeader
  );


  scheduleFixedHeader =
    fixedHeader;


  scheduleFixedHeaderTable =
    fixedHeaderTable;


  /* ==================================================
     固定職員列
  ================================================== */

  const fixedStaff =
    document.createElement(
      "div"
    );


  fixedStaff.id =
    "scheduleFixedStaffColumn";


  fixedStaff.style.position =
    "fixed";


  fixedStaff.style.display =
    "none";


  fixedStaff.style.overflow =
    "hidden";


  fixedStaff.style.margin =
    "0";


  fixedStaff.style.padding =
    "0";


  fixedStaff.style.background =
    "#ffffff";


  fixedStaff.style.zIndex =
    "1000";


  fixedStaff.style.pointerEvents =
    "none";


  fixedStaff.style.boxSizing =
    "border-box";


  const fixedStaffTable =
    document.createElement(
      "table"
    );


  fixedStaffTable.style.borderCollapse =
    "separate";


  fixedStaffTable.style.borderSpacing =
    "0";


  fixedStaffTable.style.tableLayout =
    "fixed";


  fixedStaffTable.style.margin =
    "0";


  fixedStaffTable.style.padding =
    "0";


  fixedStaffTable.style.position =
    "relative";


  /* ==================================================
     職員ヘッダー
  ================================================== */

  const fixedStaffThead =
    document.createElement(
      "thead"
    );


  const headerRows =
    Array.from(
      thead.querySelectorAll(
        "tr"
      )
    );


  headerRows.forEach(
    (originalRow, rowIndex) => {

      const newRow =
        document.createElement(
          "tr"
        );


      const staffCell =
        originalRow.querySelector(
          ".staff-header"
        );


      if (
        rowIndex === 0 &&
        staffCell
      ) {

        const cloned =
          staffCell.cloneNode(
            true
          );


        cloned.style.position =
          "static";


        cloned.style.left =
          "auto";


        cloned.style.top =
          "auto";


        cloned.style.zIndex =
          "1";


        newRow.appendChild(
          cloned
        );

      }


      fixedStaffThead.appendChild(
        newRow
      );

    }
  );


  /* ==================================================
     職員名
  ================================================== */

  const fixedStaffTbody =
    document.createElement(
      "tbody"
    );


  if (tbody) {

    const staffRows =
      tbody.querySelectorAll(
        "tr"
      );


    staffRows.forEach(
      originalRow => {

        const staffCell =
          originalRow.querySelector(
            ".staff-name-cell"
          );


        if (!staffCell) {

          return;

        }


        const newRow =
          document.createElement(
            "tr"
          );


        const cloned =
          staffCell.cloneNode(
            true
          );


        cloned.style.position =
          "static";


        cloned.style.left =
          "auto";


        cloned.style.top =
          "auto";


        cloned.style.zIndex =
          "1";


        newRow.appendChild(
          cloned
        );


        fixedStaffTbody.appendChild(
          newRow
        );

      }
    );

  }


  fixedStaffTable.appendChild(
    fixedStaffThead
  );


  fixedStaffTable.appendChild(
    fixedStaffTbody
  );


  fixedStaff.appendChild(
    fixedStaffTable
  );


  document.body.appendChild(
    fixedStaff
  );


  scheduleFixedStaffColumn =
    fixedStaff;


  scheduleFixedStaffTable =
    fixedStaffTable;


  syncScheduleFixedLayers();

}


/* =========================================================
   固定レイヤーサイズ同期
========================================================= */

function syncScheduleFixedLayers() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (!table) {

    return;

  }


  /* ==================================================
     固定ヘッダー
  ================================================== */

  if (
    scheduleFixedHeaderTable
  ) {

    const tableRect =
      table.getBoundingClientRect();


    scheduleFixedHeaderTable.style.width =
      tableRect.width +
      "px";


    scheduleFixedHeaderTable.style.minWidth =
      tableRect.width +
      "px";


    scheduleFixedHeaderTable.style.maxWidth =
      tableRect.width +
      "px";


    const originalCols =
      table.querySelectorAll(
        "colgroup col"
      );


    const fixedCols =
      scheduleFixedHeaderTable.querySelectorAll(
        "colgroup col"
      );


    originalCols.forEach(
      (originalCol, index) => {

        const fixedCol =
          fixedCols[index];


        if (!fixedCol) {

          return;

        }


        const width =
          originalCol
            .getBoundingClientRect()
            .width;


        fixedCol.style.width =
          width +
          "px";


        fixedCol.style.minWidth =
          width +
          "px";


        fixedCol.style.maxWidth =
          width +
          "px";

      }
    );


    const originalCells =
      table.querySelectorAll(
        "thead th"
      );


    const fixedCells =
      scheduleFixedHeaderTable.querySelectorAll(
        "thead th"
      );


    originalCells.forEach(
      (originalCell, index) => {

        const fixedCell =
          fixedCells[index];


        if (!fixedCell) {

          return;

        }


        const rect =
          originalCell
            .getBoundingClientRect();


        const style =
          window.getComputedStyle(
            originalCell
          );


        fixedCell.style.width =
          rect.width +
          "px";


        fixedCell.style.minWidth =
          rect.width +
          "px";


        fixedCell.style.maxWidth =
          rect.width +
          "px";


        fixedCell.style.height =
          rect.height +
          "px";


        fixedCell.style.boxSizing =
          "border-box";


        fixedCell.style.padding =
          style.padding;


        fixedCell.style.borderTop =
          style.borderTop;


        fixedCell.style.borderRight =
          style.borderRight;


        fixedCell.style.borderBottom =
          style.borderBottom;


        fixedCell.style.borderLeft =
          style.borderLeft;


        fixedCell.style.background =
          style.background;


        fixedCell.style.font =
          style.font;


        fixedCell.style.fontSize =
          style.fontSize;


        fixedCell.style.fontWeight =
          style.fontWeight;


        fixedCell.style.color =
          style.color;


        fixedCell.style.textAlign =
          style.textAlign;


        fixedCell.style.verticalAlign =
          style.verticalAlign;


        if (
          fixedCell.classList.contains(
            "staff-header"
          )
        ) {

          fixedCell.style.visibility =
            "visible";

             

        }

      }
    );

  }


  /* ==================================================
     固定職員列
  ================================================== */

  if (
    scheduleFixedStaffTable
  ) {

    const originalStaffHeader =
      table.querySelector(
        "thead .staff-header"
      );


    const originalStaffCells =
      table.querySelectorAll(
        "tbody .staff-name-cell"
      );


    let staffWidth =
      0;


    if (
      originalStaffHeader
    ) {

      staffWidth =
        originalStaffHeader
          .getBoundingClientRect()
          .width;

    } else if (
      originalStaffCells.length > 0
    ) {

      staffWidth =
        originalStaffCells[0]
          .getBoundingClientRect()
          .width;

    }


    scheduleFixedStaffTable.style.width =
      staffWidth +
      "px";


    scheduleFixedStaffTable.style.minWidth =
      staffWidth +
      "px";


    scheduleFixedStaffTable.style.maxWidth =
      staffWidth +
      "px";


    const fixedStaffHeader =
      scheduleFixedStaffTable.querySelector(
        "thead .staff-header"
      );


    if (
      fixedStaffHeader &&
      originalStaffHeader
    ) {

      const originalRect =
        originalStaffHeader
          .getBoundingClientRect();


      const originalStyle =
        window.getComputedStyle(
          originalStaffHeader
        );


      fixedStaffHeader.style.width =
        originalRect.width +
        "px";


      fixedStaffHeader.style.minWidth =
        originalRect.width +
        "px";


      fixedStaffHeader.style.maxWidth =
        originalRect.width +
        "px";


      fixedStaffHeader.style.height =
        originalRect.height +
        "px";


      fixedStaffHeader.style.boxSizing =
        "border-box";


      fixedStaffHeader.style.padding =
        originalStyle.padding;


      fixedStaffHeader.style.borderTop =
        originalStyle.borderTop;


      fixedStaffHeader.style.borderRight =
        originalStyle.borderRight;


      fixedStaffHeader.style.borderBottom =
        originalStyle.borderBottom;


      fixedStaffHeader.style.borderLeft =
        originalStyle.borderLeft;


      fixedStaffHeader.style.background =
        originalStyle.background;


      fixedStaffHeader.style.font =
        originalStyle.font;


      fixedStaffHeader.style.fontSize =
        originalStyle.fontSize;


      fixedStaffHeader.style.fontWeight =
        originalStyle.fontWeight;


      fixedStaffHeader.style.color =
        originalStyle.color;


      fixedStaffHeader.style.textAlign =
        originalStyle.textAlign;


      fixedStaffHeader.style.verticalAlign =
        originalStyle.verticalAlign;


      fixedStaffHeader.style.visibility =
        "visible";

    }


    const fixedStaffCells =
      scheduleFixedStaffTable.querySelectorAll(
        "tbody .staff-name-cell"
      );


    originalStaffCells.forEach(
      (originalCell, index) => {

        const fixedCell =
          fixedStaffCells[index];


        if (!fixedCell) {

          return;

        }


        const rect =
          originalCell
            .getBoundingClientRect();


        const style =
          window.getComputedStyle(
            originalCell
          );


        fixedCell.style.width =
          staffWidth +
          "px";


        fixedCell.style.minWidth =
          staffWidth +
          "px";


        fixedCell.style.maxWidth =
          staffWidth +
          "px";


        fixedCell.style.height =
          rect.height +
          "px";


        fixedCell.style.boxSizing =
          "border-box";


        fixedCell.style.padding =
          style.padding;


        fixedCell.style.borderTop =
          style.borderTop;


        fixedCell.style.borderRight =
          style.borderRight;


        fixedCell.style.borderBottom =
          style.borderBottom;


        fixedCell.style.borderLeft =
          style.borderLeft;


        fixedCell.style.background =
          style.background;


        fixedCell.style.font =
          style.font;


        fixedCell.style.fontSize =
          style.fontSize;


        fixedCell.style.fontWeight =
          style.fontWeight;


        fixedCell.style.color =
          style.color;


        fixedCell.style.textAlign =
          style.textAlign;


        fixedCell.style.verticalAlign =
          style.verticalAlign;

      }
    );


    const originalRows =
      table.querySelectorAll(
        "tbody tr"
      );


    const fixedRows =
      scheduleFixedStaffTable.querySelectorAll(
        "tbody tr"
      );


    originalRows.forEach(
      (originalRow, index) => {

        const fixedRow =
          fixedRows[index];


        if (!fixedRow) {

          return;

        }


        const height =
          originalRow
            .getBoundingClientRect()
            .height;


        fixedRow.style.height =
          height +
          "px";

      }
    );

  }

}


/* =========================================================
   固定レイヤー位置更新
========================================================= */

function updateScheduleFixedLayers() {

  const table =
    document.getElementById(
      "scheduleTable"
    );


  if (!table) {

    hideScheduleFixedLayers();

    return;

  }


  const thead =
    table.querySelector(
      "thead"
    );


  const wrapper =
    table.closest(
      ".table-wrapper"
    );


  if (
    !thead ||
    !wrapper
  ) {

    hideScheduleFixedLayers();

    return;

  }


  if (
    !scheduleFixedHeader ||
    !scheduleFixedStaffColumn
  ) {

    createScheduleFixedLayers();

  }


  if (
    !scheduleFixedHeader ||
    !scheduleFixedStaffColumn
  ) {

    return;

  }


  const appHeader =
    document.querySelector(
      ".header"
    );


  let topOffset =
    0;


  if (appHeader) {

    const headerRect =
      appHeader.getBoundingClientRect();


    topOffset =
      Math.max(
        0,
        headerRect.bottom
      );

  }


  const tableRect =
    table.getBoundingClientRect();


  const theadRect =
    thead.getBoundingClientRect();


  const wrapperRect =
    wrapper.getBoundingClientRect();


  const headerHeight =
    theadRect.height;


  if (
    headerHeight <= 0
  ) {

    hideScheduleFixedLayers();

    return;

  }


  if (
    tableRect.top >=
    topOffset
  ) {

    hideScheduleFixedLayers();

    return;

  }


  if (
    tableRect.bottom <=
    topOffset +
    headerHeight
  ) {

    hideScheduleFixedLayers();

    return;

  }


  scheduleFixedHeader.style.display =
    "block";


  scheduleFixedHeader.style.left =
    wrapperRect.left +
    "px";


  scheduleFixedHeader.style.top =
    topOffset +
    "px";


  scheduleFixedHeader.style.width =
    wrapperRect.width +
    "px";


  scheduleFixedHeader.style.height =
    headerHeight +
    "px";


  scheduleFixedHeaderTable.style.transform =
    "translate3d(" +
    (-wrapper.scrollLeft) +
    "px, 0, 0)";

   // 「職員」見出しだけ横方向にも固定
const fixedStaffHeader =
  scheduleFixedHeaderTable.querySelector(
    "thead .staff-header"
  );

if (fixedStaffHeader) {

  fixedStaffHeader.style.transform =
    "translate3d(" +
    wrapper.scrollLeft +
    "px, 0, 0)";

}


 // 職員名列は縦方向には固定しない。
// 元のscheduleTableのsticky(left:0)だけで
// 横方向のみ固定させる。
if (scheduleFixedStaffColumn) {
  scheduleFixedStaffColumn.style.display = "none";
}


  syncScheduleFixedLayers();

}


/* ==================================================
   固定レイヤー非表示
================================================== */

function hideScheduleFixedLayers() {

  if (
    scheduleFixedHeader
  ) {

    scheduleFixedHeader.style.display =
      "none";

  }


  if (
    scheduleFixedStaffColumn
  ) {

    scheduleFixedStaffColumn.style.display =
      "none";

  }

}


/* =========================================================
   スクロール監視
========================================================= */

window.addEventListener(
  "scroll",
  updateScheduleFixedLayers,
  {
    passive: true
  }
);


document.addEventListener(
  "scroll",
  event => {

    const wrapper =
      event.target &&
      event.target.closest
        ? event.target.closest(
            ".table-wrapper"
          )
        : null;


    if (
      wrapper &&
      scheduleFixedHeader
    ) {

      updateScheduleFixedLayers();

    }

  },
  {
    passive: true,
    capture: true
  }
);


window.addEventListener(
  "resize",
  () => {

    updateScheduleFixedLayers();

  },
  {
    passive: true
  }
);


/* ==================================================
   固定レイヤー用CSS
================================================== */

if (
  !document.getElementById(
    "scheduleFixedLayerStyle"
  )
) {

  const style =
    document.createElement(
      "style"
    );


  style.id =
    "scheduleFixedLayerStyle";


  style.textContent = `

    .table-wrapper {
      position: relative;
      overflow-x: auto;
      overflow-y: visible;
    }

    #scheduleTable .staff-header {
      position: sticky !important;
      left: 0 !important;
      z-index: 300 !important;
      background: #f2f2f7 !important;
      box-sizing: border-box;
    }

    #scheduleTable .staff-name-cell {
      position: sticky !important;
      left: 0 !important;
      z-index: 200 !important;
      background: #ffffff !important;
      box-sizing: border-box;
    }

    #scheduleFixedHeader {
      box-sizing: border-box;
      overflow: hidden;
    }

    #scheduleFixedHeader table {
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
    }

    #scheduleFixedStaffColumn {
      box-sizing: border-box;
      overflow: hidden;
    }

    #scheduleFixedStaffColumn table {
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
    }

    #scheduleFixedStaffColumn .staff-header,
    #scheduleFixedStaffColumn .staff-name-cell {
      box-sizing: border-box;
    }

  `;


  document.head.appendChild(
    style
  );

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


  /* ==================================================
     管理者か職員か判定
  ================================================== */

  const isAdmin =
    currentOrganization &&
    currentOrganization.role ===
      "admin";


  /*
     職員の場合は必ず休暇モード
  */

  if (!isAdmin) {

    shiftMenuMode =
      "leave";

  }


  buttons.innerHTML =
    "";


  /* ==================================================
     勤務形態モード
     ※ 管理者のみ
  ================================================== */

  if (
    shiftMenuMode ===
      "shift" &&
    isAdmin
  ) {

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


    /* ==================================================
       勤務削除
    ================================================== */

    const deleteShiftButton =
      document.createElement(
        "button"
      );


    deleteShiftButton.type =
      "button";


    deleteShiftButton.textContent =
      "🗑️ 勤務削除";


    deleteShiftButton.className =
      "shift-menu-button";


    deleteShiftButton.style.width =
      "100%";


    deleteShiftButton.style.minWidth =
      "100%";


    deleteShiftButton.style.gridColumn =
      "1 / -1";


    deleteShiftButton.style.boxSizing =
      "border-box";


    deleteShiftButton.style.background =
      "#6f42c1";


    deleteShiftButton.style.color =
      "#ffffff";


    deleteShiftButton.style.borderColor =
      "#59339d";


    deleteShiftButton.style.fontWeight =
      "700";


    deleteShiftButton.addEventListener(
      "click",
      async e => {

        e.stopPropagation();


        await saveWorkShift(
          staffName,
          dateKey,
          ""
        );


        menu.style.display =
          "none";


        renderSchedule();

      }
    );


    buttons.appendChild(
      deleteShiftButton
    );


    /* ==================================================
       キャンセル
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
          "#000000";


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


    /* ==================================================
       勤務削除
    ================================================== */

    if (!shiftName) {

      if (existingRow) {

        /*
          仕様：
          「勤務削除」は勤務形態だけ削除。
          休暇は残す。
        */

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


    /* ==================================================
       既存勤務更新
    ================================================== */

    if (existingRow) {

      const result =
        await supabaseClient
          .from("work_shifts")
          .update({

            shift_name:
              shiftName,

            leave_type:
              leaveType || null

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


    /* ==================================================
       新規勤務
    ================================================== */

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
              null,

             organization_id:
        currentOrganization.id

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


/* ==================================================
   休暇保存
==============================================
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

    /* ==================================================
       一般職員
       自分の休暇だけRPC経由で変更
    ================================================== */

    if (
      currentOrganization &&
      currentOrganization.role !== "admin"
    ) {

      /* -----------------------------------------------
         休暇解除
      ------------------------------------------------ */

      if (!leaveName) {

        const result =
          await supabaseClient.rpc(
            "clear_my_leave",
            {
              target_date:
                dateKey
            }
          );


        if (result.error) {

          throw result.error;

        }

      }

      /* -----------------------------------------------
         休暇登録
      ------------------------------------------------ */

      else {

        const result =
          await supabaseClient.rpc(
            "set_my_leave",
            {
              target_date:
                dateKey,

              target_leave_type:
                leaveName
            }
          );


        if (result.error) {

          throw result.error;

        }

      }


      /* -----------------------------------------------
         Supabaseから最新データを取得
      ------------------------------------------------ */

      await loadAllFromSupabase();

      renderSchedule();

      return;

    }


    /* ==================================================
       管理者
       今までどおり直接work_shiftsを操作
    ================================================== */

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


    /* ==================================================
       休暇解除
    ================================================== */

    if (!leaveName) {

      if (row) {

        /*
          勤務形態は絶対に変更しない
        */

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


    /* ==================================================
       既存勤務がある場合
       勤務形態は変更しない
    ================================================== */

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

    }


    /* ==================================================
       勤務がない場合
       休暇だけ登録
    ================================================== */

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
              leaveName,

            organization_id:
              currentOrganization.id

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
      "休暇の保存に失敗しました。\n\n" +
      "エラー：" +
      (error.message || error)
    );

  } finally {

    finishCloudOperation();

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
   年度累計
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

      /* =========================================
         既存職員の編集
         ========================================= */

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

      /* =========================================
         新規職員の追加
         ========================================= */

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

      /* -----------------------------------------
         ① staff に職員を追加
         ----------------------------------------- */

      const result =
        await supabaseClient
          .from("staff")
          .insert({
            name,
            sort_order:
              maxOrder + 1,
            organization_id:
              currentOrganization.id
          })
          .select("id")
          .single();

      if (
        result.error
      ) {
        throw result.error;
      }

      const newStaff =
        result.data;

      if (
        !newStaff ||
        !newStaff.id
      ) {
        throw new Error(
          "新しく追加した職員のIDを取得できませんでした。"
        );
      }

   }

    /* =========================================
       入力欄をリセット
       ========================================= */

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

    /* =========================================
       最新データを再取得
       ========================================= */

    await loadAllFromSupabase();

    renderStaffList();

    renderSchedule();

  } catch (error) {

    console.error(
      "職員保存エラー",
      error
    );

    alert(
      "職員の保存に失敗しました。\n\n" +
      (
        error?.message ||
        String(error)
      )
    );

  } finally {

    finishCloudOperation();

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

    finishCloudOperation();

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
    startInput?.value || "";

  const end =
    endInput?.value || "";

  const breakTime =
    breakInput?.value || "";


  /* --------------------------------------------------
     入力チェック
  -------------------------------------------------- */

  if (!name) {

    alert(
      "勤務形態名を入力してください"
    );

    return;

  }


  if (name === "明") {

    alert(
      "「明」は勤務形態として登録できません"
    );

    return;

  }


  /* --------------------------------------------------
     重複チェック
  -------------------------------------------------- */

  const duplicate =
    appData.shiftTypes.some(
      (shift, index) =>
        shift.name === name &&
        index !== editingShiftIndex
    );


  if (duplicate) {

    alert(
      "同じ勤務形態名は登録できません"
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

    /* =================================================
       編集
    ================================================= */

    if (
      editingShiftIndex >= 0
    ) {

      const oldShift =
        appData.shiftTypes[
          editingShiftIndex
        ];


      if (!oldShift) {

        throw new Error(
          "編集対象の勤務形態が見つかりません。"
        );

      }


      const oldName =
        oldShift.name;


      /* -----------------------------------------------
         勤務形態本体を更新
      ----------------------------------------------- */

      const result =
        await supabaseClient
          .from("shift_types")
          .update({

            name,

            start:
              start || null,

            end:
              end || null,

            break:
              breakTime || null

          })
          .eq(
            "id",
            oldShift.id
          );


      if (result.error) {

        throw result.error;

      }


      /* -----------------------------------------------
         勤務表で使用されている勤務形態名も変更
      ----------------------------------------------- */

      if (
        oldName !== name
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
              oldName
            );


        if (
          workResult.error
        ) {

          throw workResult.error;

        }

      }


      editingShiftIndex =
        -1;

    }

    /* =================================================
       新規追加
    ================================================= */

    else {

      const maxOrder =
        appData.shiftTypes.reduce(
          (max, shift) => {

            const value =
              Number(
                shift.sort_order
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
          .from("shift_types")
          .insert({

            name,

            start:
              start || null,

            end:
              end || null,

            break:
              breakTime || null,

            sort_order:
              maxOrder + 1,

            organization_id:
              currentOrganization.id

          });


      if (result.error) {

        throw result.error;

      }

    }


    /* =================================================
       入力欄をリセット
    ================================================= */

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


    /* =================================================
       最新データを再取得
    ================================================= */

    await loadAllFromSupabase();


    renderShiftList();

    renderSchedule();


  } catch (error) {

    console.error(
      "勤務形態保存エラー",
      error
    );


    alert(
      "勤務形態の保存に失敗しました。\n\n" +
      (error?.message || String(error))
    );


  } finally {

    finishCloudOperation();

  }

}

/* ==================================================
   職員一覧
================================================== */
async function renderStaffList() {

  const list =
    document.getElementById(
      "staffList"
    );

  if (!list) {
    return;
  }


  /*
   * ログアウト後など、
   * 職場情報がない場合は処理しない
   */

  if (
    !currentOrganization ||
    !currentOrganization.id
  ) {

    console.log(
      "★ 職場情報がないため職員一覧の権限取得を中止します"
    );

    list.innerHTML = "";

    return;

  }


  list.innerHTML = "";


  /* =====================================================
     職員ごとの権限情報を取得
  ===================================================== */

  let members = [];

  try {

    const {

      data,

      error

    } =

      await supabaseClient

        .from("organization_members")

        .select(

          "staff_id, role, user_id"

        )

        .eq(

          "organization_id",

          currentOrganization.id

        );

    // 以下は今までのコードをそのまま

    if (error) {
      throw error;
    }

    members = data || [];

  } catch (error) {

    console.error(
      "職員権限情報取得エラー",
      error
    );

    alert(
      "職員の権限情報を取得できませんでした。\n\n" +
      error.message
    );

    return;
  }


  /* =====================================================
     現在のユーザーが管理者か
  ===================================================== */

  const isAdmin =
    currentOrganization &&
    currentOrganization.role === "admin";


  /* =====================================================
     職員一覧
  ===================================================== */

  appData.staff.forEach(
    (staff, index) => {

      const name =
        getStaffName(
          staff
        );


      /* -------------------------------------------------
         この職員の権限情報
      ------------------------------------------------- */

      const member =
        members.find(
          item =>
            item.staff_id ===
            staff.id
        );


      const role =
        member?.role ||
        "staff";


      /* -------------------------------------------------
         表示する権限名
      ------------------------------------------------- */

      const roleLabel =
        role === "admin"
          ? "管理者"
          : "職員";


      const roleColor =
        role === "admin"
          ? "#007aff"
          : "#666";


      /* =================================================
         職員1人分の行
      ================================================= */

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "list-item";


      /* =================================================
         管理者ログイン時
      ================================================= */

      if (isAdmin) {

        item.innerHTML = `
          <div style="
            display:grid;
            grid-template-columns:minmax(0,1fr) auto auto auto;
            align-items:center;
            width:100%;
            column-gap:6px;
          ">

            <!-- 名前・役割 -->
            <div style="
              min-width:0;
            ">

              <div
                class="list-item-title"
                style="
                  white-space:nowrap;
                  overflow:hidden;
                  text-overflow:ellipsis;
                "
              >
                ${escapeHtml(name)}
              </div>

              <div
                class="staff-role-label"
                style="
                  font-size:13px;
                  color:${roleColor};
                  font-weight:600;
                  margin-top:4px;
                "
              >
                （${roleLabel}）
              </div>

            </div>


            <!-- ↑ ↓ -->
            <div style="
              display:flex;
              gap:6px;
              align-items:center;
              justify-content:center;
            ">

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

            </div>


            <!-- 編集・削除 -->
            <div style="
              display:flex;
              flex-direction:column;
              gap:6px;
              align-items:stretch;
            ">

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


            <!-- 管理者設定・招待リンク発行 -->
            <div style="
              display:flex;
              flex-direction:column;
              gap:6px;
              align-items:stretch;
            ">

              <button
                type="button"
                class="list-button role-change-button"
              >
                管理者設定
              </button>

              <button
                type="button"
                class="list-button invite-staff-button"
              >
                招待リンク発行
              </button>

            </div>

          </div>
        `;


      /* =================================================
         上へ
      ================================================= */

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


      /* =================================================
         下へ
      ================================================= */

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


      /* =================================================
         編集
      ================================================= */

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


      /* =================================================
         管理者設定
      ================================================= */

      item
        .querySelector(
          ".role-change-button"
        )
        ?.addEventListener(
          "click",
          async () => {

            const newRole =
              role === "admin"
                ? "staff"
                : "admin";

            const newRoleLabel =
              newRole === "admin"
                ? "管理者"
                : "職員";

            if (
              !confirm(
                `${name}さんを「${newRoleLabel}」に変更しますか？`
              )
            ) {

              return;

            }

            cloudOperationBusy =
              true;

            try {

              const {
                error
              } =
                await supabaseClient
                  .rpc(
                    "set_staff_role",
                    {
                      target_staff_id:
                        staff.id,

                      target_role:
                        newRole
                    }
                  );

              if (error) {
                throw error;
              }

              await loadAllFromSupabase();

              await renderStaffList();

            } catch (error) {

              console.error(
                "権限変更エラー",
                error
              );

              alert(
                "権限の変更に失敗しました。\n\n" +
                error.message
              );

            } finally {

              finishCloudOperation();

            }

          }
        );


      /* =================================================
         招待リンク発行
      ================================================= */

      item
        .querySelector(
          ".invite-staff-button"
        )
        ?.addEventListener(
          "click",
          async () => {

            if (
              !confirm(
                `${name}さんの招待リンクを発行しますか？`
              )
            ) {

              return;

            }

            await issueStaffInvite(
              staff.id
            );

          }
        );


      /* =================================================
         削除
      ================================================= */

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

           /* -----------------------------------------
   職員・勤務データ・ログインアカウントを削除
----------------------------------------- */

const result =
  await supabaseClient.rpc(
    "delete_staff_and_account",
    {
      target_staff_id:
        staff.id
    }
  );

if (
  result.error
) {

  throw result.error;

}

              editingStaffIndex =
                -1;

              await loadAllFromSupabase();

              await renderStaffList();

              renderSchedule();

            } catch (error) {

              console.error(
                "職員削除エラー",
                error
              );

              alert(
                "職員の削除に失敗しました。\n\n" +
                error.message
              );

            } finally {

              finishCloudOperation();

            }

          }
        );

    } else {

      /* =================================================
         職員ログイン時
      ================================================= */

      item.innerHTML = `
        <div style="
          display:flex;
          align-items:center;
          width:100%;
          gap:16px;
        ">

          <div
            class="list-item-title"
            style="
              flex:1;
              min-width:0;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            "
          >
            ${escapeHtml(name)}
          </div>

          <div
            class="staff-role-label"
            style="
              font-size:13px;
              color:${roleColor};
              font-weight:600;
              white-space:nowrap;
            "
          >
            ${roleLabel}
          </div>

        </div>
      `;

    }


    /* =================================================
       一覧へ追加
    ================================================= */

    list.appendChild(
      item
    );

  });


  /* =====================================================
     人数
  ===================================================== */

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

            color,

             organization_id:
        currentOrganization.id

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


      /* =================================================
         休暇名
      ================================================= */

      item.innerHTML = `
        <div
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            width:100%;
            gap:12px;
          "
        >

          <div
            class="list-item-title"
            style="
              flex:1;
              min-width:0;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            "
          >
            ${escapeHtml(leave.name)}
          </div>


          <div
            style="
              width:28px;
              height:28px;
              border-radius:6px;
              background:${leave.color || "#FFD54F"};
              border:1px solid #ccc;
              flex-shrink:0;
            "
          ></div>


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


      /* =================================================
         編集
      ================================================= */

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


      /* =================================================
         削除
      ================================================= */

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
                "休暇の削除に失敗しました。\n\n" +
                error.message
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
              end,

             organization_id:
  currentOrganization.id

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


/* ==================================================
   webcal登録
================================================== */

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
    ★ webcalを維持
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


/* ==================================================
   カレンダーモーダル
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

    finishCloudOperation();

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

    finishCloudOperation();

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
