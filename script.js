/* =========================================================
   Shift+ 勤務表
   script.js
   第1部：初期化・認証共通処理
   ========================================================= */


/* =========================================================
   初期ローディング画面
   ========================================================= */

function hideInitialLoading() {

  const loading =
    document.getElementById(
      "initialLoadingScreen"
    );

  if (loading) {
    loading.remove();
  }

}


/* =========================================================
   Supabase
   ========================================================= */

const SUPABASE_URL =
  "https://pyfdhlqvnponaczmbuot.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_dROecn8WChOgOOipDaIX6w_3eIWK0co";

const supabaseClient =
  supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );


/* =========================================================
   アプリ共通変数
   ========================================================= */

const STORAGE_KEY =
  "workScheduleAppData";


let currentOrganization = null;


/*
 * 現在ログインしているユーザー
 */
let currentUser = null;


/*
 * 初期化中フラグ
 */
let appInitializing = false;


/*
 * 認証処理中フラグ
 */
let authenticationBusy = false;


/*
 * 職場登録処理中フラグ
 */
let organizationCreating = false;


/* =========================================================
   勤務表アプリデータ
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
   現在表示している年月
   ========================================================= */

let currentDate = new Date();

currentDate.setDate(1);


/* =========================================================
   認証状態取得
   ========================================================= */

async function getCurrentSession() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();

    if (error) {

      console.error(
        "認証セッション取得エラー:",
        error
      );

      return null;

    }

    return data?.session || null;

  } catch (error) {

    console.error(
      "getCurrentSession エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   現在ユーザー取得
   ========================================================= */

async function getCurrentUser() {

  const session =
    await getCurrentSession();

  if (!session?.user) {

    currentUser = null;

    return null;

  }

  currentUser =
    session.user;

  return currentUser;

}


/* =========================================================
   ログイン状態確認
   ========================================================= */

async function isAuthenticated() {

  const session =
    await getCurrentSession();

  return !!session;

}


/* =========================================================
   一時保存
   新規職場登録を開始したあと、
   認証画面へ移動しても職場情報を保持する
   ========================================================= */

function savePendingOrganization(
  organizationName,
  staffName
) {

  if (organizationName) {

    sessionStorage.setItem(
      "pendingOrganizationName",
      organizationName
    );

  }

  if (staffName) {

    sessionStorage.setItem(
      "pendingStaffName",
      staffName
    );

  }

}


/* =========================================================
   一時保存した職場名取得
   ========================================================= */

function getPendingOrganizationName() {

  return sessionStorage.getItem(
    "pendingOrganizationName"
  ) || "";

}


/* =========================================================
   一時保存した登録者名取得
   ========================================================= */

function getPendingStaffName() {

  return sessionStorage.getItem(
    "pendingStaffName"
  ) || "";

}


/* =========================================================
   一時保存した職場情報を削除
   ========================================================= */

function clearPendingOrganization() {

  sessionStorage.removeItem(
    "pendingOrganizationName"
  );

  sessionStorage.removeItem(
    "pendingStaffName"
  );

}


/* =========================================================
   ログイン画面表示
   ========================================================= */

function showLoginPage() {

  const loginPage =
    document.getElementById(
      "loginPage"
    );

  const appContainer =
    document.getElementById(
      "appContainer"
    );

  if (loginPage) {

    loginPage.style.display =
      "block";

  }

  if (appContainer) {

    appContainer.style.display =
      "none";

  }

}


/* =========================================================
   アプリ画面表示
   ========================================================= */

function showApp() {

  const loginPage =
    document.getElementById(
      "loginPage"
    );

  const appContainer =
    document.getElementById(
      "appContainer"
    );

  if (loginPage) {

    loginPage.style.display =
      "none";

  }

  if (appContainer) {

    appContainer.style.display =
      "block";

  }

}


/* =========================================================
   認証後の共通処理
   ========================================================= */

async function continueAfterAuthentication() {

  console.log(
    "★ 認証後共通処理開始"
  );


  /*
   * 現在ユーザー取得
   */

  const user =
    await getCurrentUser();


  if (!user) {

    console.warn(
      "認証済みユーザーを取得できませんでした"
    );

    showLoginPage();

    return;

  }


  /*
   * 新規職場登録途中の場合
   */

  const pendingOrganizationName =
    getPendingOrganizationName();

  const pendingStaffName =
    getPendingStaffName();


  if (
    pendingOrganizationName &&
    pendingStaffName
  ) {

    console.log(
      "★ 新規職場登録を継続します"
    );

    await createOrganizationAfterAuthentication(
      pendingOrganizationName,
      pendingStaffName
    );

    return;

  }


  /*
   * 通常ログインの場合
   */

  currentOrganization =
    await getCurrentOrganization();


  /*
   * 招待登録がある場合
   */

  const inviteHandled =
    await handleInviteAfterLogin();

  if (inviteHandled) {

    return;

  }


  /*
   * 組織が取得できない場合
   */

  if (!currentOrganization) {

    console.warn(
      "所属職場がありません"
    );

    showLoginPage();

    return;

  }


  /*
   * 通常のアプリ起動
   */

  showApp();


  /*
   * Supabaseからデータ取得
   */

  await loadAllFromSupabase();


  /*
   * 勤務表その他を描画
   */

  renderAll();


  /*
   * 初期ローディング終了
   */

  hideInitialLoading();

}


/* =========================================================
   Supabase認証状態監視
   ========================================================= */

function setupAuthStateListener() {

  supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

      console.log(
        "★ Auth State:",
        event
      );


      /*
       * ログイン
       */

      if (
        event === "SIGNED_IN" &&
        session?.user
      ) {

        /*
         * 認証処理中に二重実行しない
         */

        if (authenticationBusy) {

          return;

        }

        authenticationBusy = true;

        try {

          await continueAfterAuthentication();

        } finally {

          authenticationBusy = false;

        }

        return;

      }


      /*
       * ログアウト
       */

      if (
        event === "SIGNED_OUT"
      ) {

        currentUser =
          null;

        currentOrganization =
          null;

        showLoginPage();

        return;

      }

    }
  );

}


/* =========================================================
   初期化
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


async function init() {

  if (appInitializing) {

    return;

  }

  appInitializing = true;


  try {

    console.log(
      "★ 勤務表アプリ起動"
    );


    /*
     * 認証状態監視
     */

    setupAuthStateListener();


    /*
     * 現在のセッション確認
     */

    const session =
      await getCurrentSession();


    /*
     * ログイン済み
     */

    if (session?.user) {

      console.log(
        "★ ログイン済み"
      );

      currentUser =
        session.user;

      await continueAfterAuthentication();

      return;

    }


    /*
     * 未ログイン
     */

    console.log(
      "★ 未ログイン"
    );


    showLoginPage();


    /*
     * ログイン関係イベント
     */

    setupLoginEvents();


    /*
     * 新規職場登録
     */

    setupNewOrganizationButton();


    /*
     * メール新規登録
     */

    setupEmailRegistration();


    hideInitialLoading();


  } catch (error) {

    console.error(
      "★ 初期化エラー:",
      error
    );

    showLoginPage();

    hideInitialLoading();

  } finally {

    appInitializing = false;

  }

}

/* =========================================================
   第2部：メール新規登録・メールログイン
   ========================================================= */


/* =========================================================
   メール登録・ログインのDOM取得
   ========================================================= */

function getEmailInput() {

  return document.getElementById(
    "emailInput"
  );

}


function getPasswordInput() {

  return document.getElementById(
    "passwordInput"
  );

}


function getPasswordConfirmInput() {

  return document.getElementById(
    "passwordConfirmInput"
  );

}


/* =========================================================
   メッセージ表示
   ========================================================= */

function showAuthMessage(message) {

  /*
   * 現在の画面で使用しているメッセージ欄を優先
   */

  const messageElements = [

    document.getElementById(
      "loginMessage"
    ),

    document.getElementById(
      "authMessage"
    ),

    document.getElementById(
      "registrationMessage"
    )

  ];

  const element =
    messageElements.find(
      item => item
    );

  if (element) {

    element.textContent =
      message;

  }

}


/* =========================================================
   メールアドレス取得
   ========================================================= */

function getEnteredEmail() {

  const input =
    getEmailInput();

  if (!input) {

    return "";

  }

  return input.value.trim();

}


/* =========================================================
   パスワード取得
   ========================================================= */

function getEnteredPassword() {

  const input =
    getPasswordInput();

  if (!input) {

    return "";

  }

  return input.value;

}


/* =========================================================
   パスワード確認取得
   ========================================================= */

function getEnteredPasswordConfirm() {

  const input =
    getPasswordConfirmInput();

  if (!input) {

    return "";

  }

  return input.value;

}


/* =========================================================
   メールアドレス簡易チェック
   ========================================================= */

function validateEmail(email) {

  if (!email) {

    showAuthMessage(
      "メールアドレスを入力してください。"
    );

    return false;

  }


  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


  if (
    !emailPattern.test(email)
  ) {

    showAuthMessage(
      "正しいメールアドレスを入力してください。"
    );

    return false;

  }


  return true;

}


/* =========================================================
   パスワードチェック
   ========================================================= */

function validatePassword(password) {

  if (!password) {

    showAuthMessage(
      "パスワードを入力してください。"
    );

    return false;

  }


  /*
   * Supabaseのパスワードポリシーに合わせて
   * 必要な場合はここを変更する。
   *
   * 現段階では最低6文字。
   */

  if (password.length < 6) {

    showAuthMessage(
      "パスワードは6文字以上で入力してください。"
    );

    return false;

  }


  return true;

}


/* =========================================================
   パスワード確認
   ========================================================= */

function validatePasswordConfirmation(
  password,
  passwordConfirm
) {

  if (!passwordConfirm) {

    showAuthMessage(
      "パスワード（確認）を入力してください。"
    );

    return false;

  }


  if (
    password !== passwordConfirm
  ) {

    showAuthMessage(
      "パスワードが一致していません。"
    );

    return false;

  }


  return true;

}


/* =========================================================
   メール新規登録
   ========================================================= */

async function registerWithEmail() {

  if (authenticationBusy) {

    return;

  }


  authenticationBusy = true;


  try {

    const email =
      getEnteredEmail();

    const password =
      getEnteredPassword();

    const passwordConfirm =
      getEnteredPasswordConfirm();


    /*
     * 入力チェック
     */

    if (!validateEmail(email)) {

      return;

    }


    if (!validatePassword(password)) {

      return;

    }


    if (
      !validatePasswordConfirmation(
        password,
        passwordConfirm
      )
    ) {

      return;

    }


    /*
     * 新規職場登録途中なら、
     * 職場情報を確認して保持する
     */

    const organizationName =
      getPendingOrganizationName();

    const staffName =
      getPendingStaffName();


    console.log(
      "★ メール新規登録開始"
    );


    showAuthMessage(
      "アカウントを作成しています……"
    );


    /*
     * Supabaseメール登録
     */

    const {
      data,
      error
    } =
      await supabaseClient.auth.signUp({

        email: email,

        password: password

      });


    if (error) {

      console.error(
        "メール新規登録エラー:",
        error
      );

      throw error;

    }


    console.log(
      "★ メール新規登録成功:",
      data.user
    );


    /*
     * 新規職場登録の途中だった場合、
     * 念のため職場情報を保存
     */

    if (
      organizationName &&
      staffName
    ) {

      savePendingOrganization(
        organizationName,
        staffName
      );

    }


    /*
     * メール確認が必要な場合
     */

    if (
      data.user &&
      !data.session
    ) {

      showAuthMessage(
        "確認メールを送信しました。メールを確認して登録を完了してください。"
      );


      /*
       * 確認メール後に戻ってきたときのため、
       * メールアドレスだけ保持
       */

      sessionStorage.setItem(
        "pendingRegistrationEmail",
        email
      );


      return;

    }


    /*
     * メール確認不要の場合
     */

    if (data.session) {

      currentUser =
        data.user;


      await continueAfterAuthentication();

    }

  } catch (error) {

    console.error(
      "★ メール新規登録失敗:",
      error
    );


    let message =
      "メールアドレスでの新規登録に失敗しました。";


    /*
     * Supabaseの代表的なエラーを
     * 利用者向けに変更
     */

    if (
      error?.message?.toLowerCase()
        .includes("already registered")
    ) {

      message =
        "このメールアドレスはすでに登録されています。";

    }


    if (
      error?.message?.toLowerCase()
        .includes("password")
    ) {

      message =
        "パスワードを確認してください。";

    }


    showAuthMessage(
      message
    );

  } finally {

    authenticationBusy = false;

  }

}


/* =========================================================
   メールログイン
   ========================================================= */

async function loginWithEmail() {

  if (authenticationBusy) {

    return;

  }


  authenticationBusy = true;


  try {

    const email =
      getEnteredEmail();

    const password =
      getEnteredPassword();


    /*
     * 入力チェック
     */

    if (!validateEmail(email)) {

      return;

    }


    if (!password) {

      showAuthMessage(
        "パスワードを入力してください。"
      );

      return;

    }


    showAuthMessage(
      "ログインしています……"
    );


    /*
     * Supabaseメールログイン
     */

    const {
      data,
      error
    } =
      await supabaseClient.auth.signInWithPassword({

        email: email,

        password: password

      });


    if (error) {

      console.error(
        "メールログインエラー:",
        error
      );

      throw error;

    }


    currentUser =
      data.user;


    console.log(
      "★ メールログイン成功:",
      currentUser
    );


    /*
     * 認証後はGoogleと同じ処理へ
     */

    await continueAfterAuthentication();

  } catch (error) {

    console.error(
      "★ メールログイン失敗:",
      error
    );


    let message =
      "メールアドレスまたはパスワードを確認してください。";


    if (
      error?.message
        ?.toLowerCase()
        .includes("email not confirmed")
    ) {

      message =
        "メールアドレスの確認が完了していません。確認メールをご確認ください。";

    }


    showAuthMessage(
      message
    );

  } finally {

    authenticationBusy = false;

  }

}


/* =========================================================
   メール確認後の処理
   ========================================================= */

async function handleEmailConfirmation() {

  try {

    const session =
      await getCurrentSession();


    if (!session?.user) {

      return false;

    }


    currentUser =
      session.user;


    /*
     * 保持していたメールアドレスを削除
     */

    sessionStorage.removeItem(
      "pendingRegistrationEmail"
    );


    /*
     * 認証後共通処理
     */

    await continueAfterAuthentication();


    return true;

  } catch (error) {

    console.error(
      "メール確認後処理エラー:",
      error
    );

    return false;

  }

}


/* =========================================================
   メール新規登録フォーム表示
   ========================================================= */

function showEmailRegistration() {

  const loginForm =
    document.getElementById(
      "emailLoginForm"
    );

  const registrationForm =
    document.getElementById(
      "emailRegistrationForm"
    );


  if (loginForm) {

    loginForm.style.display =
      "none";

  }


  if (registrationForm) {

    registrationForm.style.display =
      "block";

  }


  showAuthMessage("");

}


/* =========================================================
   メールログインフォーム表示
   ========================================================= */

function showEmailLogin() {

  const loginForm =
    document.getElementById(
      "emailLoginForm"
    );

  const registrationForm =
    document.getElementById(
      "emailRegistrationForm"
    );


  if (registrationForm) {

    registrationForm.style.display =
      "none";

  }


  if (loginForm) {

    loginForm.style.display =
      "block";

  }


  showAuthMessage("");

}


/* =========================================================
   メール認証イベント設定
   ========================================================= */

function setupEmailRegistration() {

  /*
   * 新規登録ボタン
   */

  const registerButton =
    document.getElementById(
      "emailRegisterButton"
    );


  if (registerButton) {

    registerButton.onclick =
      async () => {

        await registerWithEmail();

      };

  }


  /*
   * メールログインボタン
   */

  const loginButton =
    document.getElementById(
      "emailLoginButton"
    );


  if (loginButton) {

    loginButton.onclick =
      async () => {

        await loginWithEmail();

      };

  }


  /*
   * 「新規登録はこちら」
   */

  const showRegisterButton =
    document.getElementById(
      "showEmailRegistrationButton"
    );


  if (showRegisterButton) {

    showRegisterButton.onclick =
      () => {

        showEmailRegistration();

      };

  }


  /*
   * 「ログインはこちら」
   */

  const showLoginButton =
    document.getElementById(
      "showEmailLoginButton"
    );


  if (showLoginButton) {

    showLoginButton.onclick =
      () => {

        showEmailLogin();

      };

  }

}


/* =========================================================
   メール認証関連のイベントをまとめて設定
   ========================================================= */

function setupEmailAuth() {

  setupEmailRegistration();

}


/* =========================================================
   Enterキーでメールログイン・登録
   ========================================================= */

function setupEmailKeyboardEvents() {

  const inputs = [

    getEmailInput(),

    getPasswordInput(),

    getPasswordConfirmInput()

  ];


  inputs.forEach(input => {

    if (!input) {

      return;

    }


    input.addEventListener(
      "keydown",
      event => {

        if (
          event.key !== "Enter"
        ) {

          return;

        }


        /*
         * 確認パスワードが表示されている場合は
         * 新規登録として扱う
         */

        const registrationForm =
          document.getElementById(
            "emailRegistrationForm"
          );


        if (
          registrationForm &&
          registrationForm.style.display !==
            "none"
        ) {

          registerWithEmail();

        } else {

          loginWithEmail();

        }

      }
    );

  });

}

/* =========================================================
   第3部：Google新規登録・Googleログイン
   ========================================================= */


/* =========================================================
   Google認証開始
   ========================================================= */

async function loginWithGoogle() {

  if (authenticationBusy) {
    return;
  }

  authenticationBusy = true;

  try {

    console.log(
      "★ Google認証開始"
    );


    /*
     * 新規職場登録からGoogle認証する場合、
     * 職場情報はsessionStorageに保存済み。
     *
     * 通常ログインの場合は何も保存されていない。
     */


    showAuthMessage(
      "Googleアカウントを確認しています……"
    );


    /*
     * 認証後に戻ってくるURL
     */

    const redirectTo =
      window.location.origin +
      window.location.pathname;


    /*
     * Google OAuth
     */

    const {
      data,
      error
    } =
      await supabaseClient.auth.signInWithOAuth({

        provider: "google",

        options: {

          redirectTo: redirectTo

        }

      });


    if (error) {

      console.error(
        "★ Google認証エラー:",
        error
      );

      throw error;

    }


    console.log(
      "★ Google OAuth開始"
    );


  } catch (error) {

    console.error(
      "★ Googleログイン／新規登録エラー:",
      error
    );


    showAuthMessage(
      "Googleアカウントでの認証に失敗しました。"
    );


  } finally {

    /*
     * OAuthの場合、ページ遷移するので
     * ここでfalseに戻して問題ない。
     */

    authenticationBusy = false;

  }

}


/* =========================================================
   Google新規登録
   ========================================================= */

async function registerWithGoogle() {

  /*
   * Googleの新規登録も、
   * Googleログインと同じOAuthを使用する。
   *
   * 違いは「認証前に職場情報を保存しているか」。
   */

  const organizationName =
    getPendingOrganizationName();

  const staffName =
    getPendingStaffName();


  /*
   * 職場登録画面から来た場合
   */

  if (
    organizationName &&
    staffName
  ) {

    console.log(
      "★ Googleによる新規職場登録を開始"
    );


    await loginWithGoogle();

    return;

  }


  /*
   * 職場登録情報がない場合でも
   * Googleアカウント自体の新規登録／ログインは可能。
   */

  console.log(
    "★ Googleアカウント登録を開始"
  );


  await loginWithGoogle();

}


/* =========================================================
   Googleボタン設定
   ========================================================= */

function setupGoogleLogin() {

  /*
   * 既存HTMLのGoogleログインボタン
   */

  const googleLoginButton =
    document.getElementById(
      "googleLoginButton"
    );


  if (
    googleLoginButton
  ) {

    googleLoginButton.onclick =
      async () => {

        await loginWithGoogle();

      };

  }


  /*
   * 新規登録用Googleボタン
   *
   * HTML側で
   * googleRegisterButton
   * を使用する場合はこちら。
   */

  const googleRegisterButton =
    document.getElementById(
      "googleRegisterButton"
    );


  if (
    googleRegisterButton
  ) {

    googleRegisterButton.onclick =
      async () => {

        await registerWithGoogle();

      };

  }

}


/* =========================================================
   Google OAuth後のURL確認
   ========================================================= */

async function handleOAuthCallback() {

  try {

    /*
     * SupabaseがOAuth認証結果を処理したあと、
     * 現在のセッションを取得する。
     */

    const session =
      await getCurrentSession();


    if (!session?.user) {

      return false;

    }


    console.log(
      "★ OAuth認証完了"
    );


    currentUser =
      session.user;


    /*
     * Googleから戻ってきた場合も、
     * メール認証と同じ共通処理へ。
     */

    await continueAfterAuthentication();


    return true;

  } catch (error) {

    console.error(
      "★ OAuthコールバック処理エラー:",
      error
    );

    showAuthMessage(
      "認証後の処理に失敗しました。"
    );

    return false;

  }

}


/* =========================================================
   Googleアカウント情報取得
   ========================================================= */

function getGoogleUserInfo(user) {

  if (!user) {

    return null;

  }


  const metadata =
    user.user_metadata || {};


  return {

    id:
      user.id || "",

    email:
      user.email || "",

    name:
      metadata.full_name ||
      metadata.name ||
      "",

    avatar:
      metadata.avatar_url ||
      metadata.picture ||
      ""

  };

}


/* =========================================================
   Google表示名取得
   ========================================================= */

function getGoogleDisplayName(user) {

  const googleUser =
    getGoogleUserInfo(user);


  if (
    !googleUser
  ) {

    return "";

  }


  return googleUser.name || "";

}


/* =========================================================
   Googleメールアドレス取得
   ========================================================= */

function getGoogleEmail(user) {

  const googleUser =
    getGoogleUserInfo(user);


  if (
    !googleUser
  ) {

    return "";

  }


  return googleUser.email || "";

}


/* =========================================================
   Google認証後のユーザー確認
   ========================================================= */

async function processGoogleAuthentication() {

  const user =
    await getCurrentUser();


  if (!user) {

    console.warn(
      "★ Googleユーザーを取得できません"
    );

    return false;

  }


  const googleInfo =
    getGoogleUserInfo(user);


  console.log(
    "★ Googleユーザー:",
    googleInfo
  );


  /*
   * ここでは職場を直接作らない。
   *
   * 新規職場登録の場合も、
   * continueAfterAuthentication()
   * → createOrganizationAfterAuthentication()
   *
   * という共通ルートを使用する。
   */

  await continueAfterAuthentication();


  return true;

}


/* =========================================================
   Google新規登録用ボタンの表示
   ========================================================= */

function showGoogleRegistration() {

  const googleLoginArea =
    document.getElementById(
      "googleLoginArea"
    );

  const googleRegistrationArea =
    document.getElementById(
      "googleRegistrationArea"
    );


  if (
    googleLoginArea
  ) {

    googleLoginArea.style.display =
      "none";

  }


  if (
    googleRegistrationArea
  ) {

    googleRegistrationArea.style.display =
      "block";

  }


  showAuthMessage("");

}


/* =========================================================
   Googleログイン画面表示
   ========================================================= */

function showGoogleLogin() {

  const googleLoginArea =
    document.getElementById(
      "googleLoginArea"
    );

  const googleRegistrationArea =
    document.getElementById(
      "googleRegistrationArea"
    );


  if (
    googleRegistrationArea
  ) {

    googleRegistrationArea.style.display =
      "none";

  }


  if (
    googleLoginArea
  ) {

    googleLoginArea.style.display =
      "block";

  }


  showAuthMessage("");

}


/* =========================================================
   認証方式選択画面
   ========================================================= */

function showRegistrationPage() {

  /*
   * 新規職場登録から来た場合、
   * ここで認証方式を選択する。
   */

  const registrationPage =
    document.getElementById(
      "registrationPage"
    );


  const loginPage =
    document.getElementById(
      "loginPage"
    );


  if (
    loginPage
  ) {

    loginPage.style.display =
      "none";

  }


  if (
    registrationPage
  ) {

    registrationPage.style.display =
      "block";

  }


  showAuthMessage("");

}


/* =========================================================
   認証方式選択画面を閉じる
   ========================================================= */

function hideRegistrationPage() {

  const registrationPage =
    document.getElementById(
      "registrationPage"
    );


  if (
    registrationPage
  ) {

    registrationPage.style.display =
      "none";

  }


  showLoginPage();

}


/* =========================================================
   Google登録開始
   ========================================================= */

function startGoogleRegistration() {

  /*
   * 職場情報が保存されていれば、
   * 認証後にその職場を作成する。
   */

  const organizationName =
    getPendingOrganizationName();

  const staffName =
    getPendingStaffName();


  if (
    !organizationName ||
    !staffName
  ) {

    console.warn(
      "★ Google登録時の職場情報がありません"
    );

  }


  registerWithGoogle();

}


/* =========================================================
   Google認証イベントをまとめて設定
   ========================================================= */

function setupGoogleAuth() {

  setupGoogleLogin();

}

/* =========================================================
   第4部：新規職場登録
   ========================================================= */


/* =========================================================
   新規職場登録ボタンの設定
   ========================================================= */

function setupNewOrganizationButton() {

  const button =
    document.getElementById(
      "createOrganizationButton"
    );

  if (!button) {

    console.warn(
      "createOrganizationButton が見つかりません"
    );

    return;

  }


  /*
   * 既存イベントとの二重登録を防ぐ
   */

  button.onclick = async () => {

    await createNewOrganization();

  };

}


/* =========================================================
   新規職場登録画面を表示
   ========================================================= */

function showNewOrganizationForm() {

  const form =
    document.getElementById(
      "newOrganizationForm"
    );

  const loginMainView =
    document.getElementById(
      "loginMainView"
    );


  if (loginMainView) {

    loginMainView.style.display =
      "none";

  }


  if (form) {

    form.style.display =
      "block";

  }


  /*
   * 入力欄を空にする
   */

  const organizationNameInput =
    document.getElementById(
      "organizationNameInput"
    );

  const organizationStaffNameInput =
    document.getElementById(
      "organizationStaffNameInput"
    );


  if (organizationNameInput) {

    organizationNameInput.value =
      "";

  }


  if (organizationStaffNameInput) {

    organizationStaffNameInput.value =
      "";

  }


  showAuthMessage("");

}


/* =========================================================
   新規職場登録画面を閉じる
   ========================================================= */

function hideNewOrganizationForm() {

  const form =
    document.getElementById(
      "newOrganizationForm"
    );

  if (form) {

    form.style.display =
      "none";

  }


  const loginMainView =
    document.getElementById(
      "loginMainView"
    );

  if (loginMainView) {

    loginMainView.style.display =
      "block";

  }

}


/* =========================================================
   新規職場登録
   ========================================================= */

async function createNewOrganization() {

  if (organizationCreating) {

    return;

  }


  /*
   * 入力欄
   */

  const organizationNameInput =
    document.getElementById(
      "organizationNameInput"
    );


  const organizationStaffNameInput =
    document.getElementById(
      "organizationStaffNameInput"
    );


  const organizationName =
    organizationNameInput
      ?.value
      ?.trim() || "";


  const staffName =
    organizationStaffNameInput
      ?.value
      ?.trim() || "";


  /*
   * 職場名チェック
   */

  if (!organizationName) {

    showAuthMessage(
      "職場名を入力してください。"
    );

    organizationNameInput?.focus();

    return;

  }


  /*
   * 登録者名チェック
   */

  if (!staffName) {

    showAuthMessage(
      "登録者名を入力してください。"
    );

    organizationStaffNameInput?.focus();

    return;

  }


  organizationCreating = true;


  try {

    console.log(
      "★ 新規職場登録開始"
    );

    console.log(
      "職場名:",
      organizationName
    );

    console.log(
      "登録者名:",
      staffName
    );


    /*
     * 現在ログインしているか確認
     */

    const session =
      await getCurrentSession();


    /* =====================================================
       未ログイン
       ===================================================== */

    if (!session?.user) {

      console.log(
        "★ 未認証 → 認証方式選択へ"
      );


      /*
       * 職場情報を一時保存
       */

      savePendingOrganization(
        organizationName,
        staffName
      );


      /*
       * 新規登録画面へ
       */

      showRegistrationPage();


      return;

    }


    /* =====================================================
       すでにログイン済み
       ===================================================== */

    console.log(
      "★ 認証済み → 直接職場を作成"
    );


    await createOrganizationAfterAuthentication(
      organizationName,
      staffName
    );


  } catch (error) {

    console.error(
      "★ 新規職場登録エラー:",
      error
    );


    showAuthMessage(
      "職場登録の準備中にエラーが発生しました。"
    );


  } finally {

    organizationCreating = false;

  }

}


/* =========================================================
   認証後の職場作成
   ========================================================= */

async function createOrganizationAfterAuthentication(
  organizationName,
  staffName
) {

  if (organizationCreating) {

    return;

  }


  organizationCreating = true;


  try {

    console.log(
      "★ 認証後の職場作成開始"
    );


    /*
     * 現在のセッション取得
     */

    const session =
      await getCurrentSession();


    if (!session?.user) {

      throw new Error(
        "ログイン情報を取得できませんでした。"
      );

    }


    currentUser =
      session.user;


    /*
     * 入力値を整理
     */

    organizationName =
      String(
        organizationName || ""
      ).trim();


    staffName =
      String(
        staffName || ""
      ).trim();


    if (!organizationName) {

      throw new Error(
        "職場名がありません。"
      );

    }


    if (!staffName) {

      throw new Error(
        "登録者名がありません。"
      );

    }


    showAuthMessage(
      "職場を登録しています……"
    );


    console.log(
      "★ create_organization_and_admin 実行"
    );


    /* =====================================================
       職場作成RPC
       ===================================================== */

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

      console.error(
        "★ 職場作成RPCエラー:",
        error
      );

      throw error;

    }


    console.log(
      "★ 職場作成RPC結果:",
      data
    );


    /* =====================================================
       RPC結果から組織情報取得
       ===================================================== */

    let organizationResult =
      null;


    /*
     * RPCが配列を返す場合
     */

    if (
      Array.isArray(data)
    ) {

      organizationResult =
        data[0] || null;

    } else {

      organizationResult =
        data || null;

    }


    if (
      !organizationResult
    ) {

      throw new Error(
        "職場登録結果を取得できませんでした。"
      );

    }


    /* =====================================================
       currentOrganization設定
       ===================================================== */

    currentOrganization = {

      id:
        organizationResult.organization_id ??
        organizationResult.id ??
        null,

      name:
        organizationResult.organization_name ??
        organizationName,

      role:
        "admin"

    };


    console.log(
      "★ currentOrganization:",
      currentOrganization
    );


    /*
     * 組織IDが取得できなかった場合は停止
     */

    if (
      !currentOrganization.id
    ) {

      throw new Error(
        "職場IDを取得できませんでした。"
      );

    }


    /* =====================================================
       一時保存を削除
       ===================================================== */

    clearPendingOrganization();


    /* =====================================================
       アプリ起動
       ===================================================== */

    console.log(
      "★ 新規職場登録完了"
    );


    showAuthMessage(
      ""
    );


    /*
     * ログイン画面を閉じる
     */

    const loginMainView =
      document.getElementById(
        "loginMainView"
      );


    if (loginMainView) {

      loginMainView.style.display =
        "none";

    }


    const registrationPage =
      document.getElementById(
        "registrationPage"
      );


    if (registrationPage) {

      registrationPage.style.display =
        "none";

    }


    const newOrganizationForm =
      document.getElementById(
        "newOrganizationForm"
      );


    if (newOrganizationForm) {

      newOrganizationForm.style.display =
        "none";

    }


    /*
     * メインアプリ表示
     */

    showApp();


    /* =====================================================
       既存の勤務表初期化処理
       ===================================================== */

    /*
     * 現在のアプリに存在する処理を順番に実行
     */

    if (
      typeof loadLocalData ===
      "function"
    ) {

      loadLocalData();

    }


    if (
      typeof bindEvents ===
      "function"
    ) {

      bindEvents();

    }


    if (
      typeof setupLogoutButton ===
      "function"
    ) {

      setupLogoutButton();

    }


    if (
      typeof loadAllFromSupabase ===
      "function"
    ) {

      await loadAllFromSupabase();

    }


    if (
      typeof renderAll ===
      "function"
    ) {

      renderAll();

    }


    if (
      typeof loadPublicHolidays ===
      "function"
    ) {

      await loadPublicHolidays();

    }


    if (
      typeof setupRealtime ===
      "function"
    ) {

      setupRealtime();

    }


    if (
      typeof startAutoSync ===
      "function"
    ) {

      startAutoSync();

    }


    if (
      typeof setupVisibilitySync ===
      "function"
    ) {

      setupVisibilitySync();

    }


    /*
     * 初期ローディング終了
     */

    hideInitialLoading();


  } catch (error) {

    console.error(
      "★ 認証後の職場作成エラー:",
      error
    );


    /*
     * エラーになった場合、
     * currentOrganizationは無効にしないようにする。
     */

    showAuthMessage(
      error?.message ||
      "職場の登録に失敗しました。"
    );


    /*
     * エラー時は一時保存を残す。
     *
     * 再読み込みしても
     * 職場情報を失わないようにする。
     */

    savePendingOrganization(
      organizationName,
      staffName
    );


  } finally {

    organizationCreating = false;

  }

}


/* =========================================================
   新規職場登録キャンセル
   ========================================================= */

function cancelNewOrganization() {

  clearPendingOrganization();

  hideNewOrganizationForm();

  showAuthMessage("");

}


/* =========================================================
   新規職場登録イベント
   ========================================================= */

function setupOrganizationFormEvents() {

  const createButton =
    document.getElementById(
      "createOrganizationButton"
    );


  if (createButton) {

    createButton.onclick =
      async () => {

        await createNewOrganization();

      };

  }


  const cancelButton =
    document.getElementById(
      "cancelOrganizationButton"
    );


  if (cancelButton) {

    cancelButton.onclick =
      () => {

        cancelNewOrganization();

      };

  }

}


/* =========================================================
   認証方式選択から新規職場登録へ戻る
   ========================================================= */

function returnToOrganizationForm() {

  const pendingOrganizationName =
    getPendingOrganizationName();


  const pendingStaffName =
    getPendingStaffName();


  if (
    pendingOrganizationName &&
    pendingStaffName
  ) {

    showNewOrganizationForm();


    const organizationNameInput =
      document.getElementById(
        "organizationNameInput"
      );


    const organizationStaffNameInput =
      document.getElementById(
        "organizationStaffNameInput"
      );


    if (
      organizationNameInput
    ) {

      organizationNameInput.value =
        pendingOrganizationName;

    }


    if (
      organizationStaffNameInput
    ) {

      organizationStaffNameInput.value =
        pendingStaffName;

    }

    return;

  }


  hideNewOrganizationForm();

}


/* =========================================================
   新規職場登録関連イベント
   ========================================================= */

function setupOrganizationRegistration() {

  setupNewOrganizationButton();

  setupOrganizationFormEvents();

}

/* =========================================================
   第5部：職場・職員・権限・招待処理
   ========================================================= */


/* =========================================================
   現在の職場を取得
   ========================================================= */

async function getCurrentOrganization() {

  try {

    const user =
      await getCurrentUser();

    if (!user) {

      console.warn(
        "★ 現在ユーザーがいません"
      );

      return null;

    }


    /*
     * 既にcurrentOrganizationが存在する場合
     * そのまま使用する
     */

    if (
      currentOrganization?.id
    ) {

      return currentOrganization;

    }


    /* =====================================================
       ユーザーが所属している職場を取得
       ===================================================== */

    const {
      data,
      error
    } =
      await supabaseClient
        .from("organization_members")
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name
          )
        `)
        .eq(
          "user_id",
          user.id
        )
        .limit(1);


    if (error) {

      console.error(
        "★ 所属職場取得エラー:",
        error
      );

      return null;

    }


    if (
      !data ||
      data.length === 0
    ) {

      console.log(
        "★ 所属している職場がありません"
      );

      currentOrganization =
        null;

      return null;

    }


    const membership =
      data[0];


    const organization =
      membership.organizations;


    if (!organization) {

      console.warn(
        "★ 職場情報がありません"
      );

      currentOrganization =
        null;

      return null;

    }


    currentOrganization = {

      id:
        organization.id,

      name:
        organization.name,

      role:
        membership.role || "staff"

    };


    console.log(
      "★ 現在の職場:",
      currentOrganization
    );


    return currentOrganization;


  } catch (error) {

    console.error(
      "★ getCurrentOrganization エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   現在の組織ID取得
   ========================================================= */

function getCurrentOrganizationId() {

  return (
    currentOrganization?.id ||
    null
  );

}


/* =========================================================
   現在の職場名取得
   ========================================================= */

function getCurrentOrganizationName() {

  return (
    currentOrganization?.name ||
    ""
  );

}


/* =========================================================
   現在のユーザーID取得
   ========================================================= */

function getCurrentUserId() {

  return (
    currentUser?.id ||
    null
  );

}


/* =========================================================
   現在のユーザーのメールアドレス取得
   ========================================================= */

function getCurrentUserEmail() {

  return (
    currentUser?.email ||
    ""
  );

}


/* =========================================================
   現在のユーザーの表示名取得
   ========================================================= */

function getCurrentUserDisplayName() {

  if (!currentUser) {

    return "";

  }


  const metadata =
    currentUser.user_metadata ||
    {};


  return (
    metadata.full_name ||
    metadata.name ||
    metadata.display_name ||
    ""
  );

}


/* =========================================================
   管理者かどうか
   ========================================================= */

function isOrganizationAdmin() {

  const role =
    currentOrganization?.role;


  return (
    role === "admin" ||
    role === "owner"
  );

}


/* =========================================================
   職員管理権限
   ========================================================= */

function canManageStaff() {

  return isOrganizationAdmin();

}


/* =========================================================
   勤務表設定権限
   ========================================================= */

function canManageSchedule() {

  return isOrganizationAdmin();

}


/* =========================================================
   職場設定権限
   ========================================================= */

function canManageOrganization() {

  return isOrganizationAdmin();

}


/* =========================================================
   現在ユーザーの職員ID取得
   ========================================================= */

async function getCurrentStaffId() {

  try {

    const userId =
      getCurrentUserId();


    const organizationId =
      getCurrentOrganizationId();


    if (
      !userId ||
      !organizationId
    ) {

      return null;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from("staff")
        .select("id")
        .eq(
          "user_id",
          userId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();


    if (error) {

      console.error(
        "★ 現在職員ID取得エラー:",
        error
      );

      return null;

    }


    return data?.id || null;


  } catch (error) {

    console.error(
      "★ getCurrentStaffId エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   現在ユーザーの職員情報取得
   ========================================================= */

async function getCurrentStaff() {

  try {

    const userId =
      getCurrentUserId();


    const organizationId =
      getCurrentOrganizationId();


    if (
      !userId ||
      !organizationId
    ) {

      return null;

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from("staff")
        .select("*")
        .eq(
          "user_id",
          userId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();


    if (error) {

      console.error(
        "★ 現在職員情報取得エラー:",
        error
      );

      return null;

    }


    return data || null;


  } catch (error) {

    console.error(
      "★ getCurrentStaff エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   職場の職員一覧取得
   ========================================================= */

async function loadOrganizationStaff() {

  try {

    const organizationId =
      getCurrentOrganizationId();


    if (!organizationId) {

      console.warn(
        "★ 組織IDがないため職員を取得できません"
      );

      return [];

    }


    const {
      data,
      error
    } =
      await supabaseClient
        .from("staff")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "id",
          {
            ascending: true
          }
        );


    if (error) {

      console.error(
        "★ 職員一覧取得エラー:",
        error
      );

      return [];

    }


    return data || [];


  } catch (error) {

    console.error(
      "★ loadOrganizationStaff エラー:",
      error
    );

    return [];

  }

}


/* =========================================================
   職場名を画面へ表示
   ========================================================= */

function updateOrganizationNameDisplay() {

  const organizationName =
    getCurrentOrganizationName();


  /*
   * 左上の職場名
   */

  const elements = [

    document.getElementById(
      "organizationName"
    ),

    document.getElementById(
      "headerOrganizationName"
    ),

    document.getElementById(
      "currentOrganizationName"
    )

  ];


  elements.forEach(
    element => {

      if (!element) {
        return;
      }

      element.textContent =
        organizationName;

    }
  );

}


/* =========================================================
   現在ユーザー名を画面へ表示
   ========================================================= */

function updateCurrentUserDisplay() {

  const user =
    currentUser;


  if (!user) {

    return;

  }


  const metadata =
    user.user_metadata || {};


  const displayName =
    metadata.full_name ||
    metadata.name ||
    metadata.display_name ||
    user.email ||
    "";


  const elements = [

    document.getElementById(
      "currentUserName"
    ),

    document.getElementById(
      "userName"
    ),

    document.getElementById(
      "loginUserName"
    )

  ];


  elements.forEach(
    element => {

      if (!element) {
        return;
      }

      element.textContent =
        displayName;

    }
  );

}


/* =========================================================
   職場情報を画面へ反映
   ========================================================= */

function updateOrganizationUI() {

  updateOrganizationNameDisplay();

  updateCurrentUserDisplay();

}


/* =========================================================
   招待コード取得
   ========================================================= */

function getInviteCodeFromURL() {

  try {

    const url =
      new URL(
        window.location.href
      );


    /*
     * ?invite=xxxxx
     */

    const queryInvite =
      url.searchParams.get(
        "invite"
      );


    if (queryInvite) {

      return queryInvite.trim();

    }


    /*
     * #invite=xxxxx
     */

    const hash =
      window.location.hash;


    if (
      hash.startsWith("#invite=")
    ) {

      return decodeURIComponent(
        hash.substring(8)
      ).trim();

    }


    return "";

  } catch (error) {

    console.error(
      "★ 招待コード取得エラー:",
      error
    );

    return "";

  }

}


/* =========================================================
   招待コードを保存
   ========================================================= */

function savePendingInviteCode(
  inviteCode
) {

  if (!inviteCode) {

    return;

  }


  sessionStorage.setItem(
    "pendingInviteCode",
    inviteCode
  );

}


/* =========================================================
   保存された招待コード取得
   ========================================================= */

function getPendingInviteCode() {

  return (
    sessionStorage.getItem(
      "pendingInviteCode"
    ) || ""
  );

}


/* =========================================================
   招待コード削除
   ========================================================= */

function clearPendingInviteCode() {

  sessionStorage.removeItem(
    "pendingInviteCode"
  );

}


/* =========================================================
   招待コードの初期確認
   ========================================================= */

function setupInviteHandling() {

  const inviteCode =
    getInviteCodeFromURL();


  if (!inviteCode) {

    return;

  }


  console.log(
    "★ 招待コードを検出:",
    inviteCode
  );


  savePendingInviteCode(
    inviteCode
  );

}


/* =========================================================
   ログイン後の招待処理
   ========================================================= */

async function handleInviteAfterLogin() {

  try {

    const inviteCode =
      getPendingInviteCode();


    if (!inviteCode) {

      return false;

    }


    const user =
      await getCurrentUser();


    if (!user) {

      return false;

    }


    console.log(
      "★ 招待処理開始"
    );


    /*
     * 現在の実際の招待RPCがある場合は、
     * ここから呼び出す。
     *
     * RPC名・引数は現在のDB定義を優先する。
     */


    const {
      data,
      error
    } =
      await supabaseClient.rpc(
        "accept_organization_invite",
        {
          invite_code:
            inviteCode
        }
      );


    if (error) {

      console.error(
        "★ 招待処理RPCエラー:",
        error
      );

      return false;

    }


    console.log(
      "★ 招待処理完了:",
      data
    );


    /*
     * 招待コードを削除
     */

    clearPendingInviteCode();


    /*
     * 所属職場を再取得
     */

    currentOrganization =
      null;


    currentOrganization =
      await getCurrentOrganization();


    /*
     * アプリ表示
     */

    if (
      currentOrganization
    ) {

      showApp();

      await loadAllFromSupabase();

      renderAll();

      updateOrganizationUI();

      hideInitialLoading();

      return true;

    }


    return false;


  } catch (error) {

    console.error(
      "★ 招待処理エラー:",
      error
    );

    return false;

  }

}


/* =========================================================
   ログアウト
   ========================================================= */

async function logout() {

  try {

    console.log(
      "★ ログアウト開始"
    );


    const {
      error
    } =
      await supabaseClient.auth.signOut();


    if (error) {

      console.error(
        "★ ログアウトエラー:",
        error
      );

      return;

    }


    /*
     * アプリ側の状態をクリア
     */

    currentUser =
      null;

    currentOrganization =
      null;


    /*
     * 一時的な新規登録情報を削除
     */

    clearPendingOrganization();


    /*
     * ログイン画面へ
     */

    showLoginPage();


    console.log(
      "★ ログアウト完了"
    );


  } catch (error) {

    console.error(
      "★ logout エラー:",
      error
    );

  }

}


/* =========================================================
   ログアウトボタン設定
   ========================================================= */

function setupLogoutButton() {

  const buttons = [

    document.getElementById(
      "logoutButton"
    ),

    document.getElementById(
      "logoutBtn"
    )

  ];


  buttons.forEach(
    button => {

      if (!button) {
        return;
      }


      button.onclick =
        async () => {

          await logout();

        };

    }
  );

}


/* =========================================================
   権限による画面制御
   ========================================================= */

function updatePermissionUI() {

  const isAdmin =
    isOrganizationAdmin();


  /*
   * 管理者専用ボタン
   */

  const adminElements = [

    document.getElementById(
      "staffSettingsButton"
    ),

    document.getElementById(
      "shiftTypeSettingsButton"
    ),

    document.getElementById(
      "organizationSettingsButton"
    ),

    document.getElementById(
      "companyHolidaySettingsButton"
    )

  ];


  adminElements.forEach(
    element => {

      if (!element) {
        return;
      }


      element.style.display =
        isAdmin
          ? ""
          : "none";

    }
  );

}


/* =========================================================
   職場・ユーザー情報をまとめて初期化
   ========================================================= */

async function initializeOrganizationContext() {

  try {

    currentUser =
      await getCurrentUser();


    if (!currentUser) {

      currentOrganization =
        null;

      return false;

    }


    currentOrganization =
      await getCurrentOrganization();


    if (!currentOrganization) {

      console.warn(
        "★ 所属職場を取得できません"
      );

      return false;

    }


    updateOrganizationUI();

    updatePermissionUI();


    return true;


  } catch (error) {

    console.error(
      "★ 組織コンテキスト初期化エラー:",
      error
    );

    return false;

  }

}

/* =========================================================
   第6部：Supabaseデータ読み込み・共通データ処理
   ========================================================= */


/* =========================================================
   Supabaseデータ読み込み中フラグ
   ========================================================= */

let supabaseLoading = false;


/* =========================================================
   Supabase保存中フラグ
   ========================================================= */

let supabaseSaving = false;


/* =========================================================
   現在の組織IDを確認
   ========================================================= */

async function ensureOrganizationContext() {

  /*
   * currentOrganizationが既にある場合
   */

  if (
    currentOrganization?.id
  ) {

    return currentOrganization;

  }


  /*
   * なければ取得
   */

  const organization =
    await getCurrentOrganization();


  if (!organization?.id) {

    console.warn(
      "★ 組織情報を取得できませんでした"
    );

    return null;

  }


  currentOrganization =
    organization;


  return organization;

}


/* =========================================================
   Supabaseから全データを読み込む
   ========================================================= */

async function loadAllFromSupabase() {

  if (supabaseLoading) {

    console.log(
      "★ Supabase読み込み中のためスキップ"
    );

    return false;

  }


  supabaseLoading = true;


  try {

    console.log(
      "★ Supabaseからデータ読み込み開始"
    );


    /*
     * 組織確認
     */

    const organization =
      await ensureOrganizationContext();


    if (!organization?.id) {

      console.warn(
        "★ 組織IDがないため読み込みできません"
      );

      return false;

    }


    const organizationId =
      organization.id;


    /* =====================================================
       職員
       ===================================================== */

    const {
      data: staffData,
      error: staffError
    } =
      await supabaseClient
        .from("staff")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "id",
          {
            ascending: true
          }
        );


    if (staffError) {

      console.error(
        "★ 職員読み込みエラー:",
        staffError
      );

    } else {

      appData.staff =
        staffData || [];

    }


    /* =====================================================
       勤務形態
       ===================================================== */

    const {
      data: shiftTypeData,
      error: shiftTypeError
    } =
      await supabaseClient
        .from("shift_types")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "id",
          {
            ascending: true
          }
        );


    if (shiftTypeError) {

      console.error(
        "★ 勤務形態読み込みエラー:",
        shiftTypeError
      );

    } else {

      appData.shiftTypes =
        shiftTypeData || [];

    }


    /* =====================================================
       休暇種類
       ===================================================== */

    const {
      data: leaveTypeData,
      error: leaveTypeError
    } =
      await supabaseClient
        .from("leave_types")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "id",
          {
            ascending: true
          }
        );


    if (leaveTypeError) {

      console.error(
        "★ 休暇種類読み込みエラー:",
        leaveTypeError
      );

    } else {

      appData.leaveTypes =
        leaveTypeData || [];

    }


    /* =====================================================
       会社休日
       ===================================================== */

    const {
      data: holidayData,
      error: holidayError
    } =
      await supabaseClient
        .from("company_holidays")
        .select(
          "id,name,start_date,end_date,created_at"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "start_date",
          {
            ascending: true
          }
        );


    if (holidayError) {

      console.error(
        "★ 会社休日読み込みエラー:",
        holidayError
      );

    } else {

      appData.companyHolidays =
        holidayData || [];

    }


    /* =====================================================
       勤務データ
       ===================================================== */

    const {
      data: shiftData,
      error: shiftError
    } =
      await supabaseClient
        .from("work_shifts")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        );


    if (shiftError) {

      console.error(
        "★ 勤務データ読み込みエラー:",
        shiftError
      );

    } else {

      /*
       * 勤務表用オブジェクトへ変換
       */

      appData.shifts =
        {};


      (shiftData || [])
        .forEach(
          shift => {

            /*
             * 現在のアプリで使用している
             * staff_name + work_date形式を維持
             */

            const staffName =
              shift.staff_name || "";


            const workDate =
              shift.work_date || "";


            if (
              !staffName ||
              !workDate
            ) {

              return;

            }


            if (
              !appData.shifts[staffName]
            ) {

              appData.shifts[staffName] =
                {};

            }


            appData.shifts[staffName][workDate] =
              {

                id:
                  shift.id,

                staff_name:
                  shift.staff_name,

                work_date:
                  shift.work_date,

                shift_name:
                  shift.shift_name,

                excel_shift:
                  shift.excel_shift,

                leave_type:
                  shift.leave_type,

                note:
                  shift.note

              };

          }
        );

    }


    /* =====================================================
       設定
       ===================================================== */

    const {
      data: settingData,
      error: settingError
    } =
      await supabaseClient
        .from("app_settings")
        .select(
          "setting_name,setting_value"
        )
        .eq(
          "organization_id",
          organizationId
        );


    if (settingError) {

      console.error(
        "★ アプリ設定読み込みエラー:",
        settingError
      );

    } else {

      /*
       * 明け時間
       */

      const akeStart =
        settingData?.find(
          item =>
            item.setting_name ===
            "ake_start"
        );


      const akeEnd =
        settingData?.find(
          item =>
            item.setting_name ===
            "ake_end"
        );


      if (akeStart?.setting_value) {

        appData.akeTime.start =
          akeStart.setting_value;

      }


      if (akeEnd?.setting_value) {

        appData.akeTime.end =
          akeEnd.setting_value;

      }

    }


    /*
     * ローカルストレージにも保存
     */

    saveLocalData();


    console.log(
      "★ Supabaseデータ読み込み完了"
    );


    return true;


  } catch (error) {

    console.error(
      "★ loadAllFromSupabase エラー:",
      error
    );

    return false;


  } finally {

    supabaseLoading = false;

  }

}


/* =========================================================
   ローカル保存
   ========================================================= */

function saveLocalData() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        appData
      )
    );


  } catch (error) {

    console.error(
      "★ ローカル保存エラー:",
      error
    );

  }

}


/* =========================================================
   ローカル読み込み
   ========================================================= */

function loadLocalData() {

  try {

    const saved =
      localStorage.getItem(
        STORAGE_KEY
      );


    if (!saved) {

      return false;

    }


    const parsed =
      JSON.parse(
        saved
      );


    if (
      !parsed ||
      typeof parsed !== "object"
    ) {

      return false;

    }


    /*
     * 現在の構造を維持しながら
     * データを反映
     */

    appData = {

      ...appData,

      ...parsed

    };


    /*
     * 配列が壊れていた場合の保護
     */

    if (
      !Array.isArray(
        appData.staff
      )
    ) {

      appData.staff =
        [];

    }


    if (
      !Array.isArray(
        appData.shiftTypes
      )
    ) {

      appData.shiftTypes =
        [];

    }


    if (
      !Array.isArray(
        appData.leaveTypes
      )
    ) {

      appData.leaveTypes =
        [];

    }


    if (
      !Array.isArray(
        appData.companyHolidays
      )
    ) {

      appData.companyHolidays =
        [];

    }


    if (
      !appData.shifts ||
      typeof appData.shifts !==
        "object"
    ) {

      appData.shifts =
        {};

    }


    console.log(
      "★ ローカルデータ読み込み完了"
    );


    return true;


  } catch (error) {

    console.error(
      "★ ローカル読み込みエラー:",
      error
    );

    return false;

  }

}


/* =========================================================
   勤務データ1件取得
   ========================================================= */

function getShiftData(
  staffName,
  workDate
) {

  if (
    !staffName ||
    !workDate
  ) {

    return null;

  }


  return (
    appData
      .shifts?.[staffName]
      ?.[workDate] ||
    null
  );

}


/* =========================================================
   勤務データ1件をローカルへ設定
   ========================================================= */

function setShiftData(
  staffName,
  workDate,
  shiftData
) {

  if (
    !staffName ||
    !workDate
  ) {

    return;

  }


  if (
    !appData.shifts[staffName]
  ) {

    appData.shifts[staffName] =
      {};

  }


  appData.shifts[staffName][workDate] =
    shiftData;


  saveLocalData();

}


/* =========================================================
   勤務データ1件を削除
   ========================================================= */

function deleteLocalShiftData(
  staffName,
  workDate
) {

  if (
    !appData.shifts?.[staffName]
  ) {

    return;

  }


  delete appData
    .shifts[staffName][workDate];


  saveLocalData();

}


/* =========================================================
   全ローカルデータクリア
   ========================================================= */

function clearLocalAppData() {

  appData = {

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


  saveLocalData();

}


/* =========================================================
   Supabaseへの共通保存前チェック
   ========================================================= */

async function ensureCanSaveToSupabase() {

  const session =
    await getCurrentSession();


  if (!session?.user) {

    console.warn(
      "★ 未ログインのため保存できません"
    );

    return false;

  }


  const organization =
    await ensureOrganizationContext();


  if (!organization?.id) {

    console.warn(
      "★ 組織情報がないため保存できません"
    );

    return false;

  }


  return true;

}


/* =========================================================
   会社休日をSupabaseから再読み込み
   ========================================================= */

async function reloadCompanyHolidays() {

  const organizationId =
    getCurrentOrganizationId();


  if (!organizationId) {

    return [];

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("company_holidays")
        .select(
          "id,name,start_date,end_date,created_at"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "start_date",
          {
            ascending: true
          }
        );


    if (error) {

      console.error(
        "★ 会社休日再読み込みエラー:",
        error
      );

      return [];

    }


    appData.companyHolidays =
      data || [];


    saveLocalData();


    return appData.companyHolidays;


  } catch (error) {

    console.error(
      "★ reloadCompanyHolidays エラー:",
      error
    );

    return [];

  }

}


/* =========================================================
   アプリ設定取得
   ========================================================= */

async function loadAppSettings() {

  const organizationId =
    getCurrentOrganizationId();


  if (!organizationId) {

    return false;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("app_settings")
        .select(
          "setting_name,setting_value"
        )
        .eq(
          "organization_id",
          organizationId
        );


    if (error) {

      console.error(
        "★ アプリ設定取得エラー:",
        error
      );

      return false;

    }


    const akeStart =
      data?.find(
        item =>
          item.setting_name ===
          "ake_start"
      );


    const akeEnd =
      data?.find(
        item =>
          item.setting_name ===
          "ake_end"
      );


    if (akeStart?.setting_value) {

      appData.akeTime.start =
        akeStart.setting_value;

    }


    if (akeEnd?.setting_value) {

      appData.akeTime.end =
        akeEnd.setting_value;

    }


    saveLocalData();


    return true;


  } catch (error) {

    console.error(
      "★ loadAppSettings エラー:",
      error
    );

    return false;

  }

}


/* =========================================================
   Supabaseから最新状態を取得して画面更新
   ========================================================= */

async function reloadFromSupabase() {

  /*
   * 保存処理中の場合は
   * 現在のデータを上書きしない。
   */

  if (
    typeof cloudOperationBusy !==
      "undefined" &&
    cloudOperationBusy
  ) {

    console.log(
      "★ クラウド処理中のため再読み込みを保留"
    );

    return;

  }


  try {

    const success =
      await loadAllFromSupabase();


    if (!success) {

      return;

    }


    /*
     * 既存の描画処理
     */

    if (
      typeof renderAll ===
      "function"
    ) {

      renderAll();

    }


    /*
     * 固定レイヤーも更新
     */

    if (
      typeof updateScheduleFixedLayers ===
      "function"
    ) {

      updateScheduleFixedLayers();

    }


  } catch (error) {

    console.error(
      "★ reloadFromSupabase エラー:",
      error
    );

  }

}

/* =========================================================
   第7部：勤務データ保存・変更・削除・Realtime
   ========================================================= */


/* =========================================================
   勤務保存中フラグ
   ========================================================= */

let savingShift = false;


/* =========================================================
   勤務データの保存
   ========================================================= */

async function saveShiftToSupabase(
  staffName,
  workDate,
  shiftName,
  excelShift,
  leaveType = null,
  note = null
) {

  if (savingShift) {

    console.log(
      "★ 勤務保存処理中のためスキップ"
    );

    return false;

  }


  savingShift = true;


  try {

    /*
     * ログイン・組織確認
     */

    const canSave =
      await ensureCanSaveToSupabase();


    if (!canSave) {

      return false;

    }


    const organizationId =
      getCurrentOrganizationId();


    if (!organizationId) {

      console.error(
        "★ organization_id がありません"
      );

      return false;

    }


    /*
     * 必須項目確認
     */

    if (
      !staffName ||
      !workDate
    ) {

      console.error(
        "★ 職員名または勤務日がありません"
      );

      return false;

    }


    /*
     * 重要
     *
     * shift_name と excel_shift は
     * 必ず同じ保存処理で扱う。
     */

    const record = {

      organization_id:
        organizationId,

      staff_name:
        staffName,

      work_date:
        workDate,

      shift_name:
        shiftName || null,

      excel_shift:
        excelShift || null,

      leave_type:
        leaveType || null,

      note:
        note || null

    };


    console.log(
      "★ 勤務保存:",
      record
    );


    /*
     * 同じ職員・同じ日付が存在する場合は更新
     * 存在しなければ新規登録
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .from("work_shifts")
        .upsert(
          record,
          {
            onConflict:
              "staff_name,work_date"
          }
        )
        .select()
        .single();


    if (error) {

      console.error(
        "★ 勤務保存エラー:",
        error
      );

      return false;

    }


    /*
     * アプリ側にも即時反映
     */

    setShiftData(
      staffName,
      workDate,
      {

        id:
          data?.id,

        staff_name:
          staffName,

        work_date:
          workDate,

        shift_name:
          shiftName || null,

        excel_shift:
          excelShift || null,

        leave_type:
          leaveType || null,

        note:
          note || null

      }
    );


    console.log(
      "★ 勤務保存完了"
    );


    return true;


  } catch (error) {

    console.error(
      "★ saveShiftToSupabase エラー:",
      error
    );

    return false;


  } finally {

    savingShift = false;

  }

}


/* =========================================================
   勤務変更
   ========================================================= */

async function updateShift(
  staffName,
  workDate,
  shiftName,
  excelShift,
  leaveType = null,
  note = null
) {

  /*
   * Realtimeが保存途中のデータを
   * 上書きしないようにする
   */

  cloudOperationBusy = true;


  try {

    const result =
      await saveShiftToSupabase(
        staffName,
        workDate,
        shiftName,
        excelShift,
        leaveType,
        note
      );


    if (!result) {

      return false;

    }


    /*
     * 画面更新
     */

    if (
      typeof renderAll ===
      "function"
    ) {

      renderAll();

    }


    return true;


  } finally {

    cloudOperationBusy = false;

  }

}


/* =========================================================
   勤務削除
   ========================================================= */

async function deleteShiftFromSupabase(
  staffName,
  workDate
) {

  if (savingShift) {

    return false;

  }


  savingShift = true;

  cloudOperationBusy = true;


  try {

    const canSave =
      await ensureCanSaveToSupabase();


    if (!canSave) {

      return false;

    }


    const organizationId =
      getCurrentOrganizationId();


    if (!organizationId) {

      return false;

    }


    /*
     * organization_idも条件に入れる。
     *
     * 他の職場のデータを削除しないため。
     */

    const {
      error
    } =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          workDate
        );


    if (error) {

      console.error(
        "★ 勤務削除エラー:",
        error
      );

      return false;

    }


    /*
     * ローカル側も削除
     */

    deleteLocalShiftData(
      staffName,
      workDate
    );


    /*
     * 画面更新
     */

    if (
      typeof renderAll ===
      "function"
    ) {

      renderAll();

    }


    console.log(
      "★ 勤務削除完了"
    );


    return true;


  } catch (error) {

    console.error(
      "★ deleteShiftFromSupabase エラー:",
      error
    );

    return false;


  } finally {

    savingShift = false;

    cloudOperationBusy = false;

  }

}


/* =========================================================
   勤務データを取得
   ========================================================= */

async function fetchShiftFromSupabase(
  staffName,
  workDate
) {

  const organizationId =
    getCurrentOrganizationId();


  if (!organizationId) {

    return null;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .from("work_shifts")
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          workDate
        )
        .maybeSingle();


    if (error) {

      console.error(
        "★ 勤務取得エラー:",
        error
      );

      return null;

    }


    return data || null;


  } catch (error) {

    console.error(
      "★ fetchShiftFromSupabase エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   勤務変更時の共通処理
   ========================================================= */

async function changeShift(
  staffName,
  workDate,
  shiftName,
  excelShift
) {

  /*
   * shift_name と excel_shift を
   * 必ず同時に変更する。
   */

  console.log(
    "★ 勤務変更:",
    {
      staffName,
      workDate,
      shiftName,
      excelShift
    }
  );


  return await updateShift(
    staffName,
    workDate,
    shiftName,
    excelShift
  );

}


/* =========================================================
   Realtime再読み込み予約
   ========================================================= */

function scheduleRealtimeReload() {

  /*
   * 既存タイマーを解除
   */

  if (
    realtimeReloadTimer
  ) {

    clearTimeout(
      realtimeReloadTimer
    );

  }


  realtimeReloadPending =
    true;


  realtimeReloadTimer =
    setTimeout(
      async () => {

        realtimeReloadTimer =
          null;


        /*
         * 保存処理中なら、
         * 今は読み込まない。
         */

        if (
          cloudOperationBusy ||
          savingShift ||
          realtimeUpdating
        ) {

          console.log(
            "★ 保存中のためRealtime再読み込みを保留"
          );

          return;

        }


        realtimeReloadPending =
          false;


        realtimeUpdating =
          true;


        try {

          await reloadFromSupabase();


        } catch (error) {

          console.error(
            "★ Realtime再読み込みエラー:",
            error
          );


        } finally {

          realtimeUpdating =
            false;

        }

      },

      300

    );

}


/* =========================================================
   Realtime変更処理
   ========================================================= */

function handleRealtimeChange(
  payload
) {

  console.log(
    "★ Supabase Realtime変更:",
    payload
  );


  /*
   * INSERT / UPDATE / DELETE
   * すべて同じ再読み込み処理へ。
   */

  scheduleRealtimeReload();

}


/* =========================================================
   Realtime接続
   ========================================================= */

function setupRealtime() {

  /*
   * Supabaseクライアントがなければ終了
   */

  if (!supabaseClient) {

    console.warn(
      "★ Supabaseクライアントがありません"
    );

    return;

  }


  /*
   * 既存チャンネルがあれば解除
   */

  if (
    window.scheduleRealtimeChannel
  ) {

    supabaseClient
      .removeChannel(
        window.scheduleRealtimeChannel
      );

  }


  /*
   * 現在の組織を取得
   */

  const organizationId =
    getCurrentOrganizationId();


  if (!organizationId) {

    console.log(
      "★ 組織未選択のためRealtime接続を保留"
    );

    return;

  }


  /*
   * work_shifts
   */

  window.scheduleRealtimeChannel =
    supabaseClient
      .channel(
        "work-shifts-" +
        organizationId
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_shifts",
          filter:
            "organization_id=eq." +
            organizationId
        },
        handleRealtimeChange
      )
      .subscribe(
        status => {

          console.log(
            "★ Realtime:",
            status
          );

        }
      );

}


/* =========================================================
   Realtime停止
   ========================================================= */

async function stopRealtime() {

  if (
    window.scheduleRealtimeChannel
  ) {

    try {

      await supabaseClient
        .removeChannel(
          window.scheduleRealtimeChannel
        );

    } catch (error) {

      console.error(
        "★ Realtime停止エラー:",
        error
      );

    }


    window.scheduleRealtimeChannel =
      null;

  }

}


/* =========================================================
   組織変更後のRealtime再接続
   ========================================================= */

async function restartRealtime() {

  await stopRealtime();

  setupRealtime();

}


/* =========================================================
   認証後のデータ読み込み
   ========================================================= */

async function initializeAfterLogin() {

  console.log(
    "★ ログイン後のアプリ初期化"
  );


  const organization =
    await ensureOrganizationContext();


  if (!organization?.id) {

    console.log(
      "★ 組織がまだありません"
    );

    return false;

  }


  /*
   * 最新データを取得
   */

  const loaded =
    await loadAllFromSupabase();


  if (!loaded) {

    console.warn(
      "★ データ読み込みに失敗しました"
    );

  }


  /*
   * Realtime開始
   */

  setupRealtime();


  /*
   * 既存の描画処理
   */

  if (
    typeof renderAll ===
    "function"
  ) {

    renderAll();

  }


  /*
   * 固定レイヤー
   */

  if (
    typeof updateScheduleFixedLayers ===
    "function"
  ) {

    updateScheduleFixedLayers();

  }


  return true;

}

/* =========================================================
   第8部：アプリ起動・セッション復元・ログアウト
   ========================================================= */


/* =========================================================
   初期化状態
   ========================================================= */

let appInitialized = false;


/* =========================================================
   初期ローディング画面を消す
   ========================================================= */

function hideInitialLoading() {

  const loading =
    document.getElementById(
      "initialLoadingScreen"
    );


  if (loading) {

    loading.remove();

  }

}


/* =========================================================
   ログイン画面表示
   ========================================================= */

function showLoginScreen() {

  const loginScreen =
    document.getElementById(
      "loginScreen"
    );


  const appScreen =
    document.getElementById(
      "appScreen"
    );


  if (loginScreen) {

    loginScreen.style.display =
      "flex";

  }


  if (appScreen) {

    appScreen.style.display =
      "none";

  }

}


/* =========================================================
   アプリ画面表示
   ========================================================= */

function showAppScreen() {

  const loginScreen =
    document.getElementById(
      "loginScreen"
    );


  const appScreen =
    document.getElementById(
      "appScreen"
    );


  if (loginScreen) {

    loginScreen.style.display =
      "none";

  }


  if (appScreen) {

    appScreen.style.display =
      "block";

  }

}


/* =========================================================
   現在のログインセッション取得
   ========================================================= */

async function getCurrentSession() {

  if (!supabaseClient) {

    console.error(
      "★ Supabaseクライアントがありません"
    );

    return null;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .getSession();


    if (error) {

      console.error(
        "★ セッション取得エラー:",
        error
      );

      return null;

    }


    return data?.session ||
      null;


  } catch (error) {

    console.error(
      "★ getCurrentSession エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   ログインユーザー取得
   ========================================================= */

async function getCurrentUser() {

  if (!supabaseClient) {

    return null;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .getUser();


    if (error) {

      console.error(
        "★ ユーザー取得エラー:",
        error
      );

      return null;

    }


    return data?.user ||
      null;


  } catch (error) {

    console.error(
      "★ getCurrentUser エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   認証状態変更
   ========================================================= */

function setupAuthStateListener() {

  if (!supabaseClient) {

    return;

  }


  /*
   * 同じリスナーを二重登録しない
   */

  if (
    window.authStateSubscription
  ) {

    return;

  }


  const {
    data
  } =
    supabaseClient
      .auth
      .onAuthStateChange(
        async (
          event,
          session
        ) => {

          console.log(
            "★ Auth State:",
            event
          );


          /*
           * ログイン
           */

          if (
            event ===
              "SIGNED_IN" &&
            session?.user
          ) {

            /*
             * OAuthのコールバック直後は
             * セッションが確定するまで
             * 少し待つ必要がある場合がある。
             */

            setTimeout(
              async () => {

                await handleAuthenticatedUser(
                  session.user
                );

              },
              0
            );


            return;

          }


          /*
           * トークン更新
           */

          if (
            event ===
              "TOKEN_REFRESHED"
          ) {

            console.log(
              "★ セッション更新"
            );

            return;

          }


          /*
           * ログアウト
           */

          if (
            event ===
              "SIGNED_OUT"
          ) {

            await handleSignedOut();

          }

        }
      );


  window.authStateSubscription =
    data?.subscription ||
    null;

}


/* =========================================================
   認証済みユーザー処理
   ========================================================= */

async function handleAuthenticatedUser(
  user
) {

  if (!user) {

    return false;

  }


  console.log(
    "★ 認証済みユーザー:",
    user.email
  );


  /*
   * ログインユーザー情報を保存
   */

  window.currentUser =
    user;


  /*
   * まず現在の組織を確認
   */

  let organization =
    await getCurrentOrganization();


  /*
   * 組織がある場合
   */

  if (organization?.id) {

    currentOrganization =
      organization;


    console.log(
      "★ 所属組織:",
      organization
    );


    /*
     * アプリを表示
     */

    showAppScreen();


    /*
     * 最新データ読み込み
     */

    await initializeAfterLogin();


    /*
     * 初期化済み
     */

    appInitialized =
      true;


    hideInitialLoading();


    return true;

  }


  /*
   * 組織がない場合
   *
   * 新規職場登録途中の可能性がある。
   */

  console.log(
    "★ 所属組織がありません"
  );


  /*
   * 保留中の新規職場登録があるか確認
   */

  const pendingOrganization =
    getPendingOrganizationRegistration();


  if (
    pendingOrganization
  ) {

    console.log(
      "★ 新規職場登録を続行"
    );


    showAppScreen();


    /*
     * メール・Google・Apple・Azure
     * 共通の職場作成処理
     */

    const created =
      await createNewOrganization(
        pendingOrganization
      );


    if (created) {

      clearPendingOrganizationRegistration();


      await initializeAfterLogin();


      appInitialized =
        true;


      hideInitialLoading();


      return true;

    }

  }


  /*
   * 組織がない通常ログインの場合
   */

  console.log(
    "★ 職場未登録ユーザー"
  );


  /*
   * 既存の職場選択・新規職場登録画面を表示
   */

  if (
    typeof showOrganizationSelection ===
      "function"
  ) {

    showOrganizationSelection();

  } else if (
    typeof showOrganizationRegistration ===
      "function"
  ) {

    showOrganizationRegistration();

  }


  hideInitialLoading();


  return false;

}


/* =========================================================
   ログアウト処理
   ========================================================= */

async function logout() {

  if (!supabaseClient) {

    return;

  }


  try {

    /*
     * Realtime停止
     */

    if (
      typeof stopRealtime ===
      "function"
    ) {

      await stopRealtime();

    }


    /*
     * Supabaseログアウト
     */

    const {
      error
    } =
      await supabaseClient
        .auth
        .signOut();


    if (error) {

      console.error(
        "★ ログアウトエラー:",
        error
      );

      return;

    }


    /*
     * ローカル状態をクリア
     */

    currentOrganization =
      null;

    window.currentUser =
      null;

    appInitialized =
      false;


    /*
     * 画面をログイン画面へ
     */

    showLoginScreen();


    console.log(
      "★ ログアウト完了"
    );


  } catch (error) {

    console.error(
      "★ logout エラー:",
      error
    );

  }

}


/* =========================================================
   ログアウト後処理
   ========================================================= */

async function handleSignedOut() {

  console.log(
    "★ SIGNED_OUT"
  );


  currentOrganization =
    null;

  window.currentUser =
    null;

  appInitialized =
    false;


  /*
   * Realtime停止
   */

  if (
    typeof stopRealtime ===
    "function"
  ) {

    await stopRealtime();

  }


  /*
   * ログイン画面へ
   */

  showLoginScreen();


  hideInitialLoading();

}


/* =========================================================
   ログアウトボタン設定
   ========================================================= */

function setupLogoutButton() {

  /*
   * HTML側の既存ボタンを探す
   */

  const buttons =
    document.querySelectorAll(
      '[data-action="logout"],' +
      '#logoutButton,' +
      '#logoutBtn'
    );


  buttons.forEach(
    button => {

      /*
       * 二重登録防止
       */

      if (
        button.dataset.logoutBound ===
        "true"
      ) {

        return;

      }


      button.dataset.logoutBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await logout();

        }
      );

    }
  );

}


/* =========================================================
   起動時の認証確認
   ========================================================= */

async function restoreAuthentication() {

  console.log(
    "★ 認証状態確認開始"
  );


  /*
   * セッション取得
   */

  const session =
    await getCurrentSession();


  /*
   * セッションなし
   */

  if (!session?.user) {

    console.log(
      "★ 未ログイン"
    );


    currentOrganization =
      null;


    showLoginScreen();


    hideInitialLoading();


    return false;

  }


  /*
   * セッションあり
   */

  console.log(
    "★ セッション復元:",
    session.user.email
  );


  /*
   * 認証済みユーザーとして処理
   */

  return await handleAuthenticatedUser(
    session.user
  );

}


/* =========================================================
   アプリ初期化
   ========================================================= */

async function init() {

  if (appInitialized) {

    return;

  }


  console.log(
    "★ 勤務表アプリ起動"
  );


  try {

    /*
     * Supabase確認
     */

    if (!supabaseClient) {

      console.error(
        "★ Supabaseが初期化されていません"
      );

      showLoginScreen();

      hideInitialLoading();

      return;

    }


    /*
     * ローカルデータは
     * 先に読み込んでおく。
     *
     * オフライン時の表示にも利用する。
     */

    loadLocalData();


    /*
     * 認証状態監視
     */

    setupAuthStateListener();


    /*
     * ログアウトボタン
     */

    setupLogoutButton();


    /*
     * セッション復元
     */

    await restoreAuthentication();


    console.log(
      "★ 初期化完了"
    );


  } catch (error) {

    console.error(
      "★ init エラー:",
      error
    );


    showLoginScreen();


  } finally {

    hideInitialLoading();

  }

}


/* =========================================================
   DOM読み込み完了
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);


/* =========================================================
   第9部：メール認証
   ・メール新規登録
   ・メールログイン
   ・メール確認後の処理
   ・パスワードリセット
   ========================================================= */


/* =========================================================
   メール登録・ログイン処理中フラグ
   ========================================================= */

let emailAuthBusy = false;


/* =========================================================
   メールアドレス取得
   ========================================================= */

function getEmailValue() {

  const input =
    document.getElementById(
      "email"
    ) ||
    document.getElementById(
      "loginEmail"
    ) ||
    document.getElementById(
      "registerEmail"
    );


  if (!input) {

    return "";

  }


  return input.value
    .trim();

}


/* =========================================================
   パスワード取得
   ========================================================= */

function getPasswordValue() {

  const input =
    document.getElementById(
      "password"
    ) ||
    document.getElementById(
      "loginPassword"
    ) ||
    document.getElementById(
      "registerPassword"
    );


  if (!input) {

    return "";

  }


  return input.value;

}


/* =========================================================
   メールアドレスの簡易チェック
   ========================================================= */

function validateEmail(
  email
) {

  if (!email) {

    return false;

  }


  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);

}


/* =========================================================
   パスワードチェック
   ========================================================= */

function validatePassword(
  password
) {

  /*
   * Supabase側の設定を最終的な判定とする。
   * ここでは空欄だけチェック。
   */

  if (!password) {

    return false;

  }


  return true;

}


/* =========================================================
   メール新規登録
   ========================================================= */

async function signUpWithEmail() {

  if (emailAuthBusy) {

    return false;

  }


  emailAuthBusy =
    true;


  try {

    const email =
      getEmailValue();


    const password =
      getPasswordValue();


    /*
     * 入力確認
     */

    if (!validateEmail(email)) {

      alert(
        "正しいメールアドレスを入力してください。"
      );

      return false;

    }


    if (!validatePassword(password)) {

      alert(
        "パスワードを入力してください。"
      );

      return false;

    }


    /*
     * 新規職場登録情報が入力されている場合は
     * 認証後にcreateNewOrganization()へ渡せるよう
     * 先に保存する。
     */

    savePendingOrganizationRegistration();


    console.log(
      "★ メールアドレス新規登録開始"
    );


    /*
     * Supabase Auth
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .signUp({

          email:
            email,

          password:
            password

        });


    if (error) {

      console.error(
        "★ メール新規登録エラー:",
        error
      );


      alert(
        getAuthErrorMessage(
          error
        )
      );


      return false;

    }


    /*
     * userが存在する場合
     */

    if (data?.user) {

      window.currentUser =
        data.user;

    }


    /*
     * メール確認が必要な設定の場合
     */

    if (
      data?.user &&
      !data?.session
    ) {

      alert(
        "確認メールを送信しました。\n\n" +
        "メール内の確認リンクを開いて、" +
        "登録を完了してください。"
      );


      /*
       * ログイン画面へ戻す
       */

      showLoginScreen();


      return true;

    }


    /*
     * メール確認不要の場合
     *
     * そのまま共通認証処理へ。
     */

    if (
      data?.session?.user
    ) {

      await handleAuthenticatedUser(
        data.session.user
      );

    }


    return true;


  } catch (error) {

    console.error(
      "★ signUpWithEmail エラー:",
      error
    );


    alert(
      getAuthErrorMessage(
        error
      )
    );


    return false;


  } finally {

    emailAuthBusy =
      false;

  }

}


/* =========================================================
   メールログイン
   ========================================================= */

async function signInWithEmail() {

  if (emailAuthBusy) {

    return false;

  }


  emailAuthBusy =
    true;


  try {

    const email =
      getEmailValue();


    const password =
      getPasswordValue();


    /*
     * 入力確認
     */

    if (!validateEmail(email)) {

      alert(
        "正しいメールアドレスを入力してください。"
      );

      return false;

    }


    if (!validatePassword(password)) {

      alert(
        "パスワードを入力してください。"
      );

      return false;

    }


    console.log(
      "★ メールログイン開始"
    );


    /*
     * Supabase Auth
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .signInWithPassword({

          email:
            email,

          password:
            password

        });


    if (error) {

      console.error(
        "★ メールログインエラー:",
        error
      );


      alert(
        getAuthErrorMessage(
          error
        )
      );


      return false;

    }


    /*
     * セッション確認
     */

    if (
      data?.session?.user
    ) {

      await handleAuthenticatedUser(
        data.session.user
      );

    }


    return true;


  } catch (error) {

    console.error(
      "★ signInWithEmail エラー:",
      error
    );


    alert(
      getAuthErrorMessage(
        error
      )
    );


    return false;


  } finally {

    emailAuthBusy =
      false;

  }

}


/* =========================================================
   メール確認後のセッション処理
   ========================================================= */

async function handleEmailConfirmation() {

  try {

    const session =
      await getCurrentSession();


    if (!session?.user) {

      return false;

    }


    console.log(
      "★ メール確認済み"
    );


    /*
     * メール確認後も
     * Google等と同じ処理へ。
     */

    return await handleAuthenticatedUser(
      session.user
    );


  } catch (error) {

    console.error(
      "★ メール確認処理エラー:",
      error
    );

    return false;

  }

}


/* =========================================================
   パスワードリセットメール送信
   ========================================================= */

async function sendPasswordResetEmail() {

  if (emailAuthBusy) {

    return false;

  }


  emailAuthBusy =
    true;


  try {

    const email =
      getEmailValue();


    if (!validateEmail(email)) {

      alert(
        "パスワードを再設定するメールアドレスを入力してください。"
      );

      return false;

    }


    console.log(
      "★ パスワードリセットメール送信"
    );


    /*
     * 現在のアプリURLを取得
     */

    const redirectTo =
      window.location.origin +
      window.location.pathname;


    const {
      error
    } =
      await supabaseClient
        .auth
        .resetPasswordForEmail(
          email,
          {
            redirectTo:
              redirectTo
          }
        );


    if (error) {

      console.error(
        "★ パスワードリセットエラー:",
        error
      );


      alert(
        getAuthErrorMessage(
          error
        )
      );


      return false;

    }


    alert(
      "パスワード再設定用のメールを送信しました。\n\n" +
      "メールをご確認ください。"
    );


    return true;


  } catch (error) {

    console.error(
      "★ sendPasswordResetEmail エラー:",
      error
    );


    alert(
      getAuthErrorMessage(
        error
      )
    );


    return false;


  } finally {

    emailAuthBusy =
      false;

  }

}


/* =========================================================
   パスワード変更
   ========================================================= */

async function updatePassword(
  newPassword
) {

  if (!newPassword) {

    alert(
      "新しいパスワードを入力してください。"
    );

    return false;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .updateUser({

          password:
            newPassword

        });


    if (error) {

      console.error(
        "★ パスワード変更エラー:",
        error
      );


      alert(
        getAuthErrorMessage(
          error
        )
      );


      return false;

    }


    alert(
      "パスワードを変更しました。"
    );


    return true;


  } catch (error) {

    console.error(
      "★ updatePassword エラー:",
      error
    );


    alert(
      getAuthErrorMessage(
        error
      )
    );


    return false;

  }

}


/* =========================================================
   認証エラーメッセージ
   ========================================================= */

function getAuthErrorMessage(
  error
) {

  const message =
    String(
      error?.message ||
      ""
    )
      .toLowerCase();


  /*
   * メールアドレス重複
   */

  if (
    message.includes(
      "already registered"
    ) ||
    message.includes(
      "user already exists"
    )
  ) {

    return (
      "このメールアドレスはすでに登録されています。\n" +
      "ログインをお試しください。"
    );

  }


  /*
   * メールまたはパスワード
   */

  if (
    message.includes(
      "invalid login credentials"
    )
  ) {

    return (
      "メールアドレスまたはパスワードが正しくありません。"
    );

  }


  /*
   * メール確認
   */

  if (
    message.includes(
      "email not confirmed"
    )
  ) {

    return (
      "メールアドレスの確認が完了していません。\n" +
      "確認メールをご確認ください。"
    );

  }


  /*
   * パスワードが短い
   */

  if (
    message.includes(
      "password"
    ) &&
    (
      message.includes(
        "at least"
      ) ||
      message.includes(
        "characters"
      )
    )
  ) {

    return (
      "パスワードの文字数が不足しています。"
    );

  }


  /*
   * メール形式
   */

  if (
    message.includes(
      "invalid email"
    )
  ) {

    return (
      "メールアドレスの形式が正しくありません。"
    );

  }


  /*
   * その他
   */

  return (
    error?.message ||
    "認証処理中にエラーが発生しました。"
  );

}


/* =========================================================
   メール認証ボタンのイベント設定
   ========================================================= */

function setupEmailAuthEvents() {

  /*
   * 新規登録
   */

  const registerButtons =
    document.querySelectorAll(
      '[data-action="email-signup"],' +
      '#emailSignupButton,' +
      '#emailRegisterButton'
    );


  registerButtons.forEach(
    button => {

      if (
        button.dataset.emailBound ===
        "true"
      ) {

        return;

      }


      button.dataset.emailBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await signUpWithEmail();

        }
      );

    }
  );


  /*
   * ログイン
   */

  const loginButtons =
    document.querySelectorAll(
      '[data-action="email-login"],' +
      '#emailLoginButton,' +
      '#loginButton'
    );


  loginButtons.forEach(
    button => {

      if (
        button.dataset.emailLoginBound ===
        "true"
      ) {

        return;

      }


      button.dataset.emailLoginBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await signInWithEmail();

        }
      );

    }
  );


  /*
   * パスワード再設定
   */

  const resetButtons =
    document.querySelectorAll(
      '[data-action="password-reset"],' +
      '#passwordResetButton,' +
      '#forgotPasswordButton'
    );


  resetButtons.forEach(
    button => {

      if (
        button.dataset.resetBound ===
        "true"
      ) {

        return;

      }


      button.dataset.resetBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await sendPasswordResetEmail();

        }
      );

    }
  );

}


/* =========================================================
   第8部のinitから呼び出す
   ========================================================= */

function setupEmailAuthentication() {

  setupEmailAuthEvents();

}

/* =========================================================
   第10部：Google認証
   ・Googleログイン
   ・Google新規職場登録
   ・OAuthコールバック処理
   ========================================================= */


/* =========================================================
   Google認証処理中フラグ
   ========================================================= */

let googleAuthBusy = false;


/* =========================================================
   Google OAuth開始
   ========================================================= */

async function signInWithGoogle(
  mode = "login"
) {

  if (googleAuthBusy) {

    return false;

  }


  googleAuthBusy =
    true;


  try {

    /*
     * Supabaseクライアント確認
     */

    if (!supabaseClient) {

      console.error(
        "★ Supabaseクライアントがありません"
      );

      alert(
        "サーバーに接続できません。"
      );

      return false;

    }


    /*
     * 新規職場登録の場合
     *
     * Google認証後にcreateNewOrganization()
     * へ渡すため、入力済みの職場情報を保存。
     */

    if (
      mode ===
      "register"
    ) {

      const saved =
        savePendingOrganizationRegistration();


      if (!saved) {

        console.warn(
          "★ 新規職場登録情報を保存できませんでした"
        );

      }

    }


    /*
     * OAuthから戻ってくるURL
     *
     * 現在のページへ戻す。
     */

    const redirectTo =
      window.location.origin +
      window.location.pathname;


    console.log(
      "★ Google OAuth開始"
    );


    /*
     * Supabase Google OAuth
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .signInWithOAuth({

          provider:
            "google",

          options: {

            redirectTo:
              redirectTo,

            queryParams: {

              access_type:
                "offline",

              prompt:
                "select_account"

            }

          }

        });


    if (error) {

      console.error(
        "★ Google OAuthエラー:",
        error
      );


      alert(
        getAuthErrorMessage(
          error
        )
      );


      return false;

    }


    console.log(
      "★ Google OAuthへ移動:",
      data?.url
    );


    /*
     * signInWithOAuth()が
     * ブラウザを遷移させるため、
     * 通常ここから先はOAuth復帰後に実行される。
     */

    return true;


  } catch (error) {

    console.error(
      "★ signInWithGoogle エラー:",
      error
    );


    alert(
      getAuthErrorMessage(
        error
      )
    );


    return false;


  } finally {

    googleAuthBusy =
      false;

  }

}


/* =========================================================
   Googleログイン
   ========================================================= */

async function loginWithGoogle() {

  return await signInWithGoogle(
    "login"
  );

}


/* =========================================================
   Googleで新規職場登録
   ========================================================= */

async function registerOrganizationWithGoogle() {

  /*
   * 職場情報を保存してからGoogleへ。
   */

  const saved =
    savePendingOrganizationRegistration();


  if (!saved) {

    console.warn(
      "★ 新規職場登録情報を確認してください"
    );

    return false;

  }


  return await signInWithGoogle(
    "register"
  );

}


/* =========================================================
   OAuthコールバック判定
   ========================================================= */

function isOAuthCallback() {

  const url =
    new URL(
      window.location.href
    );


  /*
   * PKCE方式の場合
   */

  if (
    url.searchParams.has(
      "code"
    )
  ) {

    return true;

  }


  /*
   * 古いImplicit Flow等の
   * hash形式にも対応
   */

  const hash =
    window.location.hash;


  if (
    hash &&
    (
      hash.includes(
        "access_token="
      ) ||
      hash.includes(
        "refresh_token="
      )
    )
  ) {

    return true;

  }


  return false;

}


/* =========================================================
   OAuthコールバック処理
   ========================================================= */

async function handleOAuthCallback() {

  if (!isOAuthCallback()) {

    return false;

  }


  console.log(
    "★ OAuthコールバック検出"
  );


  try {

    /*
     * SupabaseがURLのcodeを処理して
     * セッションを確立する。
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .auth
        .exchangeCodeForSession(
          new URL(
            window.location.href
          )
            .searchParams
            .get(
              "code"
            )
        );


    /*
     * codeが存在しない場合は
     * 既にSupabaseがセッションを復元している
     * 可能性がある。
     */

    if (
      error &&
      !new URL(
        window.location.href
      )
        .searchParams
        .get(
          "code"
        )
    ) {

      console.warn(
        "★ OAuthセッション確認へ移行:",
        error
      );

    } else if (error) {

      console.error(
        "★ OAuthコード交換エラー:",
        error
      );

      alert(
        getAuthErrorMessage(
          error
        )
      );

      return false;

    }


    /*
     * URLをきれいにする
     *
     * codeを残したままにしない。
     */

    const cleanUrl =
      window.location.origin +
      window.location.pathname;


    window.history.replaceState(
      {},
      document.title,
      cleanUrl
    );


    /*
     * セッション取得
     */

    const session =
      await getCurrentSession();


    if (!session?.user) {

      console.error(
        "★ OAuth後にセッションを取得できません"
      );


      alert(
        "Google認証は完了しましたが、ログイン情報を取得できませんでした。\n" +
        "もう一度お試しください。"
      );


      return false;

    }


    /*
     * Google認証後も
     * メール認証と同じ処理へ。
     */

    console.log(
      "★ Google認証完了:",
      session.user.email
    );


    await handleAuthenticatedUser(
      session.user
    );


    return true;


  } catch (error) {

    console.error(
      "★ handleOAuthCallback エラー:",
      error
    );


    alert(
      "Google認証後の処理でエラーが発生しました。\n" +
      "もう一度お試しください。"
    );


    return false;

  }

}


/* =========================================================
   Googleボタンのイベント設定
   ========================================================= */

function setupGoogleAuthEvents() {

  /*
   * Googleログイン
   */

  const loginButtons =
    document.querySelectorAll(
      '[data-action="google-login"],' +
      '#googleLoginButton,' +
      '#googleSignInButton'
    );


  loginButtons.forEach(
    button => {

      if (
        button.dataset.googleLoginBound ===
        "true"
      ) {

        return;

      }


      button.dataset.googleLoginBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await loginWithGoogle();

        }
      );

    }
  );


  /*
   * Googleで新規職場登録
   */

  const registerButtons =
    document.querySelectorAll(
      '[data-action="google-register"],' +
      '#googleRegisterButton,' +
      '#googleOrganizationRegisterButton'
    );


  registerButtons.forEach(
    button => {

      if (
        button.dataset.googleRegisterBound ===
        "true"
      ) {

        return;

      }


      button.dataset.googleRegisterBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await registerOrganizationWithGoogle();

        }
      );

    }
  );

}


/* =========================================================
   Google認証セットアップ
   ========================================================= */

function setupGoogleAuthentication() {

  setupGoogleAuthEvents();

}


/* =========================================================
   OAuth対応版init
   ========================================================= */

async function initializeAuthentication() {

  /*
   * OAuthから戻ってきた場合
   */

  if (
    isOAuthCallback()
  ) {

    console.log(
      "★ OAuthコールバック処理"
    );


    const handled =
      await handleOAuthCallback();


    if (handled) {

      return true;

    }

  }


  /*
   * 通常起動
   */

  return await restoreAuthentication();

}


/* =========================================================
   第11部：新規職場登録 共通処理
   ・職場名
   ・管理者職員名
   ・メール / Google / Apple / Azure 共通
   ・create_organization_and_admin
   ========================================================= */


/* =========================================================
   新規職場登録情報を保存するキー
   ========================================================= */

const PENDING_ORGANIZATION_KEY =
  "pendingOrganizationRegistration";


/* =========================================================
   新規職場登録情報を取得
   ========================================================= */

function getOrganizationRegistrationValues() {

  /*
   * 職場名
   */

  const organizationInput =
    document.getElementById(
      "organizationName"
    ) ||
    document.getElementById(
      "newOrganizationName"
    ) ||
    document.getElementById(
      "companyName"
    );


  /*
   * 管理者の職員名
   */

  const staffInput =
    document.getElementById(
      "staffName"
    ) ||
    document.getElementById(
      "newStaffName"
    ) ||
    document.getElementById(
      "adminStaffName"
    );


  const organizationName =
    organizationInput
      ?.value
      ?.trim() ||
    "";


  const staffName =
    staffInput
      ?.value
      ?.trim() ||
    "";


  return {

    organizationName:
      organizationName,

    staffName:
      staffName

  };

}


/* =========================================================
   新規職場登録情報の入力確認
   ========================================================= */

function validateOrganizationRegistration(
  values
) {

  if (
    !values?.organizationName
  ) {

    alert(
      "職場名を入力してください。"
    );

    return false;

  }


  if (
    !values?.staffName
  ) {

    alert(
      "管理者の職員名を入力してください。"
    );

    return false;

  }


  return true;

}


/* =========================================================
   新規職場登録情報を一時保存
   ========================================================= */

function savePendingOrganizationRegistration() {

  try {

    const values =
      getOrganizationRegistrationValues();


    /*
     * 入力欄が現在の画面に存在しない場合
     * 既に保存済みの情報を維持する。
     */

    if (
      !values.organizationName ||
      !values.staffName
    ) {

      const existing =
        getPendingOrganizationRegistration();


      if (existing) {

        return true;

      }


      /*
       * 新規登録画面から呼ばれた場合は
       * 入力不足として扱う。
       */

      if (
        document.getElementById(
          "organizationName"
        ) ||
        document.getElementById(
          "newOrganizationName"
        ) ||
        document.getElementById(
          "companyName"
        )
      ) {

        return false;

      }

    }


    const data = {

      organizationName:
        values.organizationName,

      staffName:
        values.staffName,

      createdAt:
        new Date().toISOString()

    };


    localStorage.setItem(
      PENDING_ORGANIZATION_KEY,
      JSON.stringify(
        data
      )
    );


    console.log(
      "★ 新規職場登録情報を一時保存:",
      data
    );


    return true;


  } catch (error) {

    console.error(
      "★ 新規職場登録情報保存エラー:",
      error
    );

    return false;

  }

}


/* =========================================================
   保留中の新規職場登録情報を取得
   ========================================================= */

function getPendingOrganizationRegistration() {

  try {

    const saved =
      localStorage.getItem(
        PENDING_ORGANIZATION_KEY
      );


    if (!saved) {

      return null;

    }


    const data =
      JSON.parse(
        saved
      );


    if (
      !data ||
      !data.organizationName ||
      !data.staffName
    ) {

      return null;

    }


    return data;


  } catch (error) {

    console.error(
      "★ 保留中職場情報取得エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   保留中の新規職場登録情報を削除
   ========================================================= */

function clearPendingOrganizationRegistration() {

  try {

    localStorage.removeItem(
      PENDING_ORGANIZATION_KEY
    );


    console.log(
      "★ 保留中の職場登録情報を削除"
    );


  } catch (error) {

    console.error(
      "★ 保留情報削除エラー:",
      error
    );

  }

}


/* =========================================================
   新規職場作成中フラグ
   ========================================================= */

let creatingOrganization =
  false;


/* =========================================================
   新規職場作成
   ========================================================= */

async function createNewOrganization(
  registrationData = null
) {

  if (creatingOrganization) {

    console.log(
      "★ 職場作成処理中です"
    );

    return false;

  }


  creatingOrganization =
    true;


  cloudOperationBusy =
    true;


  try {

    /*
     * 認証ユーザー確認
     */

    const user =
      await getCurrentUser();


    if (!user) {

      console.error(
        "★ 認証ユーザーが存在しません"
      );

      alert(
        "ログイン情報を確認できませんでした。"
      );

      return false;

    }


    /*
     * 登録情報を取得
     */

    const values =
      registrationData ||
      getPendingOrganizationRegistration();


    if (!values) {

      console.error(
        "★ 新規職場登録情報がありません"
      );

      return false;

    }


    const organizationName =
      values.organizationName
        ?.trim();


    const staffName =
      values.staffName
        ?.trim();


    if (
      !organizationName ||
      !staffName
    ) {

      alert(
        "職場名と職員名を入力してください。"
      );

      return false;

    }


    console.log(
      "★ 新規職場作成開始",
      {
        organizationName,
        staffName,
        userId: user.id
      }
    );


    /*
     * =====================================================
     * 重要
     *
     * 職場作成は認証方式によって分けない。
     *
     * Email
     * Google
     * Apple
     * Azure
     *
     * すべて同じRPCを使用する。
     * =====================================================
     */

    const {
      data,
      error
    } =
      await supabaseClient
        .rpc(
          "create_organization_and_admin",
          {
            new_org_name:
              organizationName,

            new_staff_name:
              staffName
          }
        );


    if (error) {

      console.error(
        "★ 新規職場作成RPCエラー:",
        error
      );


      /*
       * よくあるエラーを分かりやすく表示
       */

      const message =
        String(
          error.message ||
          ""
        );


      if (
        message
          .toLowerCase()
          .includes(
            "duplicate"
          )
      ) {

        alert(
          "この職場名はすでに登録されている可能性があります。"
        );

      } else {

        alert(
          "職場の登録に失敗しました。\n\n" +
          message
        );

      }


      return false;

    }


    console.log(
      "★ 新規職場作成完了:",
      data
    );


    /*
     * RPCの返却値から
     * organization_idを取得
     */

    let organizationId =
      null;


    if (
      typeof data ===
      "string"
    ) {

      organizationId =
        data;

    } else if (
      data?.organization_id
    ) {

      organizationId =
        data.organization_id;

    } else if (
      data?.id
    ) {

      organizationId =
        data.id;

    } else if (
      Array.isArray(data) &&
      data[0]
    ) {

      organizationId =
        data[0].organization_id ||
        data[0].id ||
        null;

    }


    /*
     * organization_idが取得できなかった場合
     *
     * RPCが正常終了していても、
     * currentOrganizationを設定できないので
     * ここでは勝手に別の組織を選ばない。
     */

    if (!organizationId) {

      console.warn(
        "★ RPCは成功しましたがorganization_idを取得できませんでした"
      );


      /*
       * RPC後にユーザーの所属組織を再取得
       */

      const organization =
        await getCurrentOrganization();


      if (organization?.id) {

        currentOrganization =
          organization;

      }

    } else {

      /*
       * organization_idから
       * 組織情報を取得
       */

      const {
        data:
          organization,
        error:
          organizationError
      } =
        await supabaseClient
          .from("organizations")
          .select("*")
          .eq(
            "id",
            organizationId
          )
          .maybeSingle();


      if (organizationError) {

        console.error(
          "★ 作成した組織取得エラー:",
          organizationError
        );

      } else if (
        organization
      ) {

        currentOrganization =
          organization;

      }

    }


    /*
     * 組織情報が最終的に取得できたか確認
     */

    if (
      !currentOrganization?.id
    ) {

      console.error(
        "★ 作成した職場をcurrentOrganizationに設定できません"
      );


      alert(
        "職場は登録されましたが、職場情報を取得できませんでした。\n" +
        "一度ログアウトして再度ログインしてください。"
      );


      return false;

    }


    /*
     * 登録成功
     */

    clearPendingOrganizationRegistration();


    console.log(
      "★ currentOrganization:",
      currentOrganization
    );


    /*
     * アプリデータを初期化
     *
     * 新規職場なので、以前の職場の
     * ローカルデータを混ぜない。
     */

    clearLocalAppData();


    /*
     * 新しい職場のデータを読み込む
     */

    await loadAllFromSupabase();


    /*
     * Realtime接続
     */

    await restartRealtime();


    /*
     * アプリ表示
     */

    showAppScreen();


    if (
      typeof renderAll ===
      "function"
    ) {

      renderAll();

    }


    if (
      typeof updateScheduleFixedLayers ===
      "function"
    ) {

      updateScheduleFixedLayers();

    }


    console.log(
      "★ 新規職場登録処理完了"
    );


    return true;


  } catch (error) {

    console.error(
      "★ createNewOrganization エラー:",
      error
    );


    alert(
      "新規職場登録中にエラーが発生しました。\n\n" +
      (
        error?.message ||
        "不明なエラー"
      )
    );


    return false;


  } finally {

    creatingOrganization =
      false;

    cloudOperationBusy =
      false;

  }

}


/* =========================================================
   新規職場登録ボタン
   ========================================================= */

async function submitNewOrganizationRegistration() {

  /*
   * 入力値確認
   */

  const values =
    getOrganizationRegistrationValues();


  if (
    !validateOrganizationRegistration(
      values
    )
  ) {

    return false;

  }


  /*
   * 入力情報を保存
   */

  const saved =
    savePendingOrganizationRegistration();


  if (!saved) {

    alert(
      "職場登録情報を保存できませんでした。"
    );

    return false;

  }


  /*
   * 現在の認証状態を確認
   */

  const user =
    await getCurrentUser();


  /*
   * まだ認証していない場合
   *
   * 認証方法を選択する画面へ。
   */

  if (!user) {

    if (
      typeof showRegistrationAuthChoice ===
      "function"
    ) {

      showRegistrationAuthChoice();

    }


    return true;

  }


  /*
   * 既に認証済みなら
   * そのまま職場作成。
   */

  return await createNewOrganization(
    values
  );

}


/* =========================================================
   新規職場登録イベント
   ========================================================= */

function setupOrganizationRegistrationEvents() {

  const buttons =
    document.querySelectorAll(
      '[data-action="organization-register"],' +
      '#organizationRegisterButton,' +
      '#newOrganizationRegisterButton,' +
      '#createOrganizationButton'
    );


  buttons.forEach(
    button => {

      if (
        button.dataset.organizationRegisterBound ===
        "true"
      ) {

        return;

      }


      button.dataset.organizationRegisterBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await submitNewOrganizationRegistration();

        }
      );

    }
  );

}


/* =========================================================
   新規職場登録セットアップ
   ========================================================= */

function setupOrganizationRegistration() {

  setupOrganizationRegistrationEvents();

}

/* =========================================================
   第12部：認証画面・新規職場登録画面
   ========================================================= */


/* =========================================================
   認証画面取得
   ========================================================= */

function getAuthElement(
  ...ids
) {

  for (const id of ids) {

    const element =
      document.getElementById(id);


    if (element) {

      return element;

    }

  }


  return null;

}


/* =========================================================
   すべての認証画面を非表示
   ========================================================= */

function hideAllAuthScreens() {

  const screens = [

    "loginScreen",

    "registerScreen",

    "organizationRegistrationScreen",

    "registrationAuthChoice",

    "forgotPasswordScreen",

    "passwordResetScreen"

  ];


  screens.forEach(
    id => {

      const element =
        document.getElementById(id);


      if (element) {

        element.style.display =
          "none";

      }

    }
  );

}


/* =========================================================
   ログイン画面
   ========================================================= */

function showLoginScreen() {

  hideAllAuthScreens();


  const loginScreen =
    getAuthElement(
      "loginScreen"
    );


  if (loginScreen) {

    loginScreen.style.display =
      "flex";

  }


  const appScreen =
    getAuthElement(
      "appScreen"
    );


  if (appScreen) {

    appScreen.style.display =
      "none";

  }

}


/* =========================================================
   メール新規登録画面
   ========================================================= */

function showEmailRegistration() {

  hideAllAuthScreens();


  const screen =
    getAuthElement(
      "registerScreen",
      "emailRegistrationScreen"
    );


  if (screen) {

    screen.style.display =
      "flex";

  }


  const appScreen =
    getAuthElement(
      "appScreen"
    );


  if (appScreen) {

    appScreen.style.display =
      "none";

  }

}


/* =========================================================
   新規職場登録画面
   ========================================================= */

function showOrganizationRegistration() {

  hideAllAuthScreens();


  const screen =
    getAuthElement(
      "organizationRegistrationScreen",
      "newOrganizationScreen",
      "organizationRegisterScreen"
    );


  if (screen) {

    screen.style.display =
      "flex";

  }


  const appScreen =
    getAuthElement(
      "appScreen"
    );


  if (appScreen) {

    appScreen.style.display =
      "none";

  }

}


/* =========================================================
   新規職場登録の認証方法選択
   ========================================================= */

function showRegistrationAuthChoice() {

  /*
   * 職場情報は既に
   * localStorageへ保存されている。
   */

  hideAllAuthScreens();


  const screen =
    getAuthElement(
      "registrationAuthChoice",
      "organizationAuthChoice",
      "registerAuthChoice"
    );


  if (screen) {

    screen.style.display =
      "flex";

  }


  const appScreen =
    getAuthElement(
      "appScreen"
    );


  if (appScreen) {

    appScreen.style.display =
      "none";

  }

}


/* =========================================================
   パスワード再設定画面
   ========================================================= */

function showForgotPasswordScreen() {

  hideAllAuthScreens();


  const screen =
    getAuthElement(
      "forgotPasswordScreen",
      "passwordResetScreen"
    );


  if (screen) {

    screen.style.display =
      "flex";

  }

}


/* =========================================================
   アプリ画面
   ========================================================= */

function showAppScreen() {

  hideAllAuthScreens();


  const appScreen =
    getAuthElement(
      "appScreen"
    );


  if (appScreen) {

    appScreen.style.display =
      "block";

  }

}


/* =========================================================
   新規職場登録 → 認証方法選択
   ========================================================= */

async function startOrganizationRegistration() {

  const values =
    getOrganizationRegistrationValues();


  if (
    !validateOrganizationRegistration(
      values
    )
  ) {

    return false;

  }


  /*
   * 職場名・職員名を保存
   */

  const saved =
    savePendingOrganizationRegistration();


  if (!saved) {

    alert(
      "職場登録情報を保存できませんでした。"
    );

    return false;

  }


  /*
   * 認証方法選択画面へ
   */

  showRegistrationAuthChoice();


  return true;

}


/* =========================================================
   メールで新規職場登録開始
   ========================================================= */

async function startEmailOrganizationRegistration() {

  /*
   * 職場登録情報を確認
   */

  const pending =
    getPendingOrganizationRegistration();


  if (!pending) {

    /*
     * まだ保存されていなければ
     * 現在の入力欄から保存。
     */

    const saved =
      savePendingOrganizationRegistration();


    if (!saved) {

      alert(
        "職場名と職員名を入力してください。"
      );

      return false;

    }

  }


  /*
   * メール登録画面
   */

  showEmailRegistration();


  return true;

}


/* =========================================================
   Googleで新規職場登録開始
   ========================================================= */

async function startGoogleOrganizationRegistration() {

  /*
   * 職場情報確認
   */

  const pending =
    getPendingOrganizationRegistration();


  if (!pending) {

    const saved =
      savePendingOrganizationRegistration();


    if (!saved) {

      alert(
        "職場名と職員名を入力してください。"
      );

      return false;

    }

  }


  /*
   * Google認証開始
   */

  return await registerOrganizationWithGoogle();

}


/* =========================================================
   ログイン画面へ戻る
   ========================================================= */

function backToLoginScreen() {

  showLoginScreen();

}


/* =========================================================
   新規職場登録画面へ戻る
   ========================================================= */

function backToOrganizationRegistration() {

  showOrganizationRegistration();

}


/* =========================================================
   認証方法選択 → メール
   ========================================================= */

function setupRegistrationEmailButton() {

  const buttons =
    document.querySelectorAll(
      '[data-action="registration-email"],' +
      '#registrationEmailButton,' +
      '#emailOrganizationRegisterButton'
    );


  buttons.forEach(
    button => {

      if (
        button.dataset.registrationEmailBound ===
        "true"
      ) {

        return;

      }


      button.dataset.registrationEmailBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await startEmailOrganizationRegistration();

        }
      );

    }
  );

}


/* =========================================================
   認証方法選択 → Google
   ========================================================= */

function setupRegistrationGoogleButton() {

  const buttons =
    document.querySelectorAll(
      '[data-action="registration-google"],' +
      '#registrationGoogleButton,' +
      '#googleOrganizationRegisterButton'
    );


  buttons.forEach(
    button => {

      if (
        button.dataset.registrationGoogleBound ===
        "true"
      ) {

        return;

      }


      button.dataset.registrationGoogleBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await startGoogleOrganizationRegistration();

        }
      );

    }
  );

}


/* =========================================================
   新規職場登録ボタン
   ========================================================= */

function setupStartOrganizationButton() {

  const buttons =
    document.querySelectorAll(
      '[data-action="start-organization-registration"],' +
      '#startOrganizationRegistration,' +
      '#newOrganizationButton'
    );


  buttons.forEach(
    button => {

      if (
        button.dataset.startOrganizationBound ===
        "true"
      ) {

        return;

      }


      button.dataset.startOrganizationBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await startOrganizationRegistration();

        }
      );

    }
  );

}


/* =========================================================
   ログイン画面へ戻るボタン
   ========================================================= */

function setupBackToLoginButtons() {

  const buttons =
    document.querySelectorAll(
      '[data-action="back-to-login"],' +
      '#backToLoginButton,' +
      '#backLoginButton'
    );


  buttons.forEach(
    button => {

      if (
        button.dataset.backLoginBound ===
        "true"
      ) {

        return;

      }


      button.dataset.backLoginBound =
        "true";


      button.addEventListener(
        "click",
        event => {

          event.preventDefault();


          backToLoginScreen();

        }
      );

    }
  );

}


/* =========================================================
   認証画面セットアップ
   ========================================================= */

function setupAuthenticationScreens() {

  setupStartOrganizationButton();

  setupRegistrationEmailButton();

  setupRegistrationGoogleButton();

  setupBackToLoginButtons();

}

/* =========================================================
   第13部：認証プロバイダー共通処理
   ========================================================= */


/* =========================================================
   現在使用する認証方法
   ========================================================= */

let currentAuthProvider = null;


/*
 * 使用可能な認証方法
 *
 * email  ：メール
 * google ：Google
 * apple  ：Apple
 * azure  ：Microsoft Azure
 */

const AUTH_PROVIDERS = {

  EMAIL: "email",

  GOOGLE: "google",

  APPLE: "apple",

  AZURE: "azure"

};


/* =========================================================
   認証方法を保存
   ========================================================= */

function setCurrentAuthProvider(
  provider
) {

  currentAuthProvider =
    provider;


  try {

    sessionStorage.setItem(
      "currentAuthProvider",
      provider
    );

  } catch (error) {

    console.warn(
      "認証方法の保存に失敗:",
      error
    );

  }

}


/* =========================================================
   認証方法を取得
   ========================================================= */

function getCurrentAuthProvider() {

  if (
    currentAuthProvider
  ) {

    return currentAuthProvider;

  }


  try {

    return sessionStorage.getItem(
      "currentAuthProvider"
    );

  } catch (error) {

    return null;

  }

}


/* =========================================================
   認証方法をクリア
   ========================================================= */

function clearCurrentAuthProvider() {

  currentAuthProvider =
    null;


  try {

    sessionStorage.removeItem(
      "currentAuthProvider"
    );

  } catch (error) {

    console.warn(
      "認証方法の削除に失敗:",
      error
    );

  }

}


/* =========================================================
   OAuth認証かどうか
   ========================================================= */

function isOAuthProvider(
  provider
) {

  return (

    provider ===
      AUTH_PROVIDERS.GOOGLE ||

    provider ===
      AUTH_PROVIDERS.APPLE ||

    provider ===
      AUTH_PROVIDERS.AZURE

  );

}


/* =========================================================
   新規職場登録中かどうか
   ========================================================= */

function isPendingOrganizationRegistration() {

  const pending =
    getPendingOrganizationRegistration();


  return !!pending;

}


/* =========================================================
   認証後の共通処理
   ========================================================= */

async function processAuthenticationSuccess(
  user
) {

  if (!user) {

    console.error(
      "認証成功後のユーザー情報がありません"
    );

    return false;

  }


  console.log(
    "★ 認証成功:",
    user.email || user.id
  );


  /*
   * 現在のユーザーを保存
   */

  window.currentUser =
    user;


  /*
   * 新規職場登録情報が残っている場合
   */

  const pendingOrganization =
    getPendingOrganizationRegistration();


  if (
    pendingOrganization
  ) {

    console.log(
      "★ 新規職場登録情報を検出"
    );


    try {

      const created =
        await createNewOrganization(
          pendingOrganization
        );


      if (created) {

        clearCurrentAuthProvider();

        return true;

      }


      console.error(
        "★ 新規職場の作成に失敗"
      );


      return false;


    } catch (error) {

      console.error(
        "★ 新規職場作成エラー:",
        error
      );


      return false;

    }

  }


  /*
   * 通常ログイン
   */

  try {

    const organization =
      await getCurrentOrganization();


    if (
      organization
    ) {

      currentOrganization =
        organization;


      showAppScreen();


      await initializeAfterLogin();


      clearCurrentAuthProvider();


      return true;

    }


  } catch (error) {

    console.error(
      "★ 職場情報取得エラー:",
      error
    );

  }


  /*
   * 職場がまだ決まっていない場合
   */

  showOrganizationSelection();


  clearCurrentAuthProvider();


  return true;

}


/* =========================================================
   メール認証成功
   ========================================================= */

async function processEmailAuthenticationSuccess(
  user
) {

  setCurrentAuthProvider(
    AUTH_PROVIDERS.EMAIL
  );


  return await processAuthenticationSuccess(
    user
  );

}


/* =========================================================
   Google認証成功
   ========================================================= */

async function processGoogleAuthenticationSuccess(
  user
) {

  setCurrentAuthProvider(
    AUTH_PROVIDERS.GOOGLE
  );


  return await processAuthenticationSuccess(
    user
  );

}


/* =========================================================
   Apple認証成功
   ========================================================= */

async function processAppleAuthenticationSuccess(
  user
) {

  setCurrentAuthProvider(
    AUTH_PROVIDERS.APPLE
  );


  return await processAuthenticationSuccess(
    user
  );

}


/* =========================================================
   Azure認証成功
   ========================================================= */

async function processAzureAuthenticationSuccess(
  user
) {

  setCurrentAuthProvider(
    AUTH_PROVIDERS.AZURE
  );


  return await processAuthenticationSuccess(
    user
  );

}


/* =========================================================
   OAuthプロバイダー開始
   ========================================================= */

async function startOAuthAuthentication(
  provider,
  options = {}
) {

  if (
    !isOAuthProvider(provider)
  ) {

    console.error(
      "未対応のOAuthプロバイダー:",
      provider
    );

    return false;

  }


  setCurrentAuthProvider(
    provider
  );


  /*
   * 新規職場登録の場合、
   * 職場情報を先に保存しておく
   */

  if (
    options.organizationRegistration
  ) {

    const pending =
      getPendingOrganizationRegistration();


    if (!pending) {

      const saved =
        savePendingOrganizationRegistration();


      if (!saved) {

        alert(
          "職場名と職員名を入力してください。"
        );

        clearCurrentAuthProvider();

        return false;

      }

    }

  }


  /*
   * Google
   */

  if (
    provider ===
    AUTH_PROVIDERS.GOOGLE
  ) {

    return await signInWithGoogle(
      options.mode ||
        "login"
    );

  }


  /*
   * Apple
   *
   * Supabase側でApple Providerを
   * 有効にした後に使用する。
   */

  if (
    provider ===
    AUTH_PROVIDERS.APPLE
  ) {

    return await startAppleAuthentication(
      options
    );

  }


  /*
   * Azure
   *
   * Supabase側でAzure Providerを
   * 有効にした後に使用する。
   */

  if (
    provider ===
    AUTH_PROVIDERS.AZURE
  ) {

    return await startAzureAuthentication(
      options
    );

  }


  return false;

}


/* =========================================================
   Apple認証
   ========================================================= */

async function startAppleAuthentication(
  options = {}
) {

  if (
    !supabaseClient
  ) {

    alert(
      "サーバーに接続できません。"
    );

    return false;

  }


  try {

    const redirectTo =
      `${window.location.origin}${window.location.pathname}`;


    const {
      error
    } =
      await supabaseClient.auth.signInWithOAuth({

        provider: "apple",

        options: {

          redirectTo:

            options.redirectTo ||
            redirectTo

        }

      });


    if (error) {

      console.error(
        "Apple認証エラー:",
        error
      );


      alert(
        getAuthErrorMessage(
          error
        )
      );


      return false;

    }


    return true;


  } catch (error) {

    console.error(
      "Apple認証開始エラー:",
      error
    );


    alert(
      getAuthErrorMessage(
        error
      )
    );


    return false;

  }

}


/* =========================================================
   Azure認証
   ========================================================= */

async function startAzureAuthentication(
  options = {}
) {

  if (
    !supabaseClient
  ) {

    alert(
      "サーバーに接続できません。"
    );

    return false;

  }


  try {

    const redirectTo =
      `${window.location.origin}${window.location.pathname}`;


    const {
      error
    } =
      await supabaseClient.auth.signInWithOAuth({

        provider: "azure",

        options: {

          redirectTo:

            options.redirectTo ||
            redirectTo

        }

      });


    if (error) {

      console.error(
        "Azure認証エラー:",
        error
      );


      alert(
        getAuthErrorMessage(
          error
        )
      );


      return false;

    }


    return true;


  } catch (error) {

    console.error(
      "Azure認証開始エラー:",
      error
    );


    alert(
      getAuthErrorMessage(
        error
      )
    );


    return false;

  }

}


/* =========================================================
   Googleで新規職場登録
   ========================================================= */

async function startGoogleOrganizationRegistrationV2() {

  return await startOAuthAuthentication(

    AUTH_PROVIDERS.GOOGLE,

    {

      mode: "register",

      organizationRegistration:
        true

    }

  );

}


/* =========================================================
   Appleで新規職場登録
   ========================================================= */

async function startAppleOrganizationRegistration() {

  return await startOAuthAuthentication(

    AUTH_PROVIDERS.APPLE,

    {

      mode: "register",

      organizationRegistration:
        true

    }

  );

}


/* =========================================================
   Azureで新規職場登録
   ========================================================= */

async function startAzureOrganizationRegistration() {

  return await startOAuthAuthentication(

    AUTH_PROVIDERS.AZURE,

    {

      mode: "register",

      organizationRegistration:
        true

    }

  );

}


/* =========================================================
   Appleで通常ログイン
   ========================================================= */

async function loginWithApple() {

  return await startOAuthAuthentication(

    AUTH_PROVIDERS.APPLE,

    {

      mode: "login"

    }

  );

}


/* =========================================================
   Azureで通常ログイン
   ========================================================= */

async function loginWithAzure() {

  return await startOAuthAuthentication(

    AUTH_PROVIDERS.AZURE,

    {

      mode: "login"

    }

  );

}


/* =========================================================
   認証方法選択ボタン
   ========================================================= */

function setupProviderSelectionButtons() {

  /*
   * Google
   */

  document
    .querySelectorAll(
      '[data-auth-provider="google"]'
    )
    .forEach(
      button => {

        if (
          button.dataset.providerBound ===
          "true"
        ) {

          return;

        }


        button.dataset.providerBound =
          "true";


        button.addEventListener(
          "click",
          async event => {

            event.preventDefault();


            const registration =
              isPendingOrganizationRegistration();


            if (
              registration
            ) {

              await startGoogleOrganizationRegistrationV2();

            } else {

              await startOAuthAuthentication(
                AUTH_PROVIDERS.GOOGLE,
                {
                  mode: "login"
                }
              );

            }

          }
        );

      }
    );


  /*
   * Apple
   */

  document
    .querySelectorAll(
      '[data-auth-provider="apple"]'
    )
    .forEach(
      button => {

        if (
          button.dataset.providerBound ===
          "true"
        ) {

          return;

        }


        button.dataset.providerBound =
          "true";


        button.addEventListener(
          "click",
          async event => {

            event.preventDefault();


            const registration =
              isPendingOrganizationRegistration();


            if (
              registration
            ) {

              await startAppleOrganizationRegistration();

            } else {

              await loginWithApple();

            }

          }
        );

      }
    );


  /*
   * Azure
   */

  document
    .querySelectorAll(
      '[data-auth-provider="azure"]'
    )
    .forEach(
      button => {

        if (
          button.dataset.providerBound ===
          "true"
        ) {

          return;

        }


        button.dataset.providerBound =
          "true";


        button.addEventListener(
          "click",
          async event => {

            event.preventDefault();


            const registration =
              isPendingOrganizationRegistration();


            if (
              registration
            ) {

              await startAzureOrganizationRegistration();

            } else {

              await loginWithAzure();

            }

          }
        );

      }
    );

}


/* =========================================================
   認証共通セットアップ
   ========================================================= */

function setupAuthenticationProviderSystem() {

  setupProviderSelectionButtons();

}

function setupAuthenticationScreens() {

  setupStartOrganizationButton();

  setupRegistrationEmailButton();

  setupRegistrationGoogleButton();

  setupBackToLoginButtons();

  setupAuthenticationProviderSystem();

}

/* =========================================================
   第14部：認証状態・OAuthコールバック
   ========================================================= */


/* =========================================================
   認証状態確認
   ========================================================= */

async function getCurrentSession() {

  if (!supabaseClient) {

    console.error(
      "★ Supabaseクライアントがありません"
    );

    return null;

  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();


    if (error) {

      console.error(
        "★ セッション取得エラー:",
        error
      );

      return null;

    }


    return data?.session || null;


  } catch (error) {

    console.error(
      "★ getCurrentSession エラー:",
      error
    );

    return null;

  }

}


/* =========================================================
   現在のユーザー取得
   ========================================================= */

async function getCurrentUser() {

  const session =
    await getCurrentSession();


  if (
    !session ||
    !session.user
  ) {

    return null;

  }


  return session.user;

}


/* =========================================================
   OAuthコールバック判定
   ========================================================= */

function isOAuthCallback() {

  const url =
    new URL(
      window.location.href
    );


  /*
   * PKCE方式
   */

  if (
    url.searchParams.has("code")
  ) {

    return true;

  }


  /*
   * Implicit Flow等で
   * access_tokenがURLハッシュに入る場合
   */

  if (
    window.location.hash &&
    (
      window.location.hash.includes(
        "access_token"
      ) ||
      window.location.hash.includes(
        "refresh_token"
      )
    )
  ) {

    return true;

  }


  return false;

}


/* =========================================================
   OAuthコールバック処理
   ========================================================= */

async function handleOAuthCallback() {

  if (!supabaseClient) {

    return false;

  }


  const url =
    new URL(
      window.location.href
    );


  const code =
    url.searchParams.get(
      "code"
    );


  /*
   * PKCEのcodeがある場合だけ交換する
   */

  if (code) {

    try {

      const {
        data,
        error
      } =
        await supabaseClient.auth
          .exchangeCodeForSession(
            code
          );


      if (error) {

        console.error(
          "★ OAuthセッション交換エラー:",
          error
        );

        return false;

      }


      /*
       * URLからcodeを削除
       */

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );


      if (
        data?.session?.user
      ) {

        await processAuthenticationSuccess(
          data.session.user
        );

        return true;

      }

    } catch (error) {

      console.error(
        "★ OAuthコールバックエラー:",
        error
      );

      return false;

    }

  }


  /*
   * SupabaseがURLからセッションを
   * 自動取得できる場合
   */

  const session =
    await getCurrentSession();


  if (
    session?.user
  ) {

    /*
     * URLハッシュを削除
     */

    if (
      window.location.hash
    ) {

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

    }


    await processAuthenticationSuccess(
      session.user
    );


    return true;

  }


  return false;

}


/* =========================================================
   Auth State Change
   ========================================================= */

let authStateProcessing = false;


function setupAuthStateListener() {

  if (!supabaseClient) {

    return;

  }


  if (
    window.__shiftAuthListenerStarted
  ) {

    return;

  }


  window.__shiftAuthListenerStarted =
    true;


  supabaseClient.auth.onAuthStateChange(
    async (
      event,
      session
    ) => {

      console.log(
        "★ Auth状態:",
        event
      );


      /*
       * TOKEN_REFRESHED等では
       * 画面を作り直さない
       */

      if (
        event ===
        "TOKEN_REFRESHED"
      ) {

        return;

      }


      /*
       * サインアウト
       */

      if (
        event ===
        "SIGNED_OUT"
      ) {

        handleSignedOut();

        return;

      }


      /*
       * ログイン・登録・OAuth
       */

      if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      ) {

        if (
          authStateProcessing
        ) {

          return;

        }


        if (
          !session?.user
        ) {

          return;

        }


        authStateProcessing =
          true;


        try {

          await processAuthenticationSuccess(
            session.user
          );

        } catch (error) {

          console.error(
            "★ Auth処理エラー:",
            error
          );

        } finally {

          authStateProcessing =
            false;

        }

      }

    }
  );

}


/* =========================================================
   サインアウト後
   ========================================================= */

function handleSignedOut() {

  window.currentUser =
    null;


  currentOrganization =
    null;


  clearCurrentAuthProvider();


  showLoginScreen();

}


/* =========================================================
   認証復元
   ========================================================= */

async function restoreAuthentication() {

  if (!supabaseClient) {

    showLoginScreen();

    return false;

  }


  /*
   * OAuthコールバック中か確認
   */

  if (
    isOAuthCallback()
  ) {

    const handled =
      await handleOAuthCallback();


    if (handled) {

      return true;

    }

  }


  /*
   * 通常の既存セッション
   */

  const session =
    await getCurrentSession();


  if (
    session?.user
  ) {

    await processAuthenticationSuccess(
      session.user
    );


    return true;

  }


  showLoginScreen();


  return false;

}


/* =========================================================
   認証初期化
   ========================================================= */

async function initializeAuthentication() {

  try {

    /*
     * OAuthコールバックまたは
     * 保存済みセッションを処理
     */

    await restoreAuthentication();


  } catch (error) {

    console.error(
      "★ 認証初期化エラー:",
      error
    );


    showLoginScreen();

  }

}

/* =========================================================
   第15部：ログアウト・職場切り替え
   ========================================================= */


/* =========================================================
   ログアウト
   ========================================================= */

async function logout() {

  if (
    !supabaseClient
  ) {

    handleSignedOut();

    return;

  }


  try {

    /*
     * Realtime停止
     */

    if (
      typeof stopRealtime ===
      "function"
    ) {

      stopRealtime();

    }


    /*
     * Supabaseからログアウト
     */

    const {
      error
    } =
      await supabaseClient.auth.signOut();


    if (error) {

      console.error(
        "★ ログアウトエラー:",
        error
      );

      alert(
        getAuthErrorMessage(
          error
        )
      );

      return;

    }


    /*
     * ローカル状態をクリア
     */

    handleSignedOut();


  } catch (error) {

    console.error(
      "★ logout エラー:",
      error
    );

  }

}


/* =========================================================
   ログアウトボタン
   ========================================================= */

function setupLogoutButton() {

  const buttons =
    document.querySelectorAll(
      '[data-action="logout"],' +
      '#logoutButton,' +
      '#logoutBtn'
    );


  buttons.forEach(
    button => {

      if (
        button.dataset.logoutBound ===
        "true"
      ) {

        return;

      }


      button.dataset.logoutBound =
        "true";


      button.addEventListener(
        "click",
        async event => {

          event.preventDefault();


          await logout();

        }
      );

    }
  );

}


/* =========================================================
   職場情報をクリア
   ========================================================= */

function clearCurrentOrganization() {

  currentOrganization =
    null;


  /*
   * 組織専用のローカルデータを消去
   */

  if (
    typeof clearLocalAppData ===
    "function"
  ) {

    clearLocalAppData();

  }

}


/* =========================================================
   職場選択画面
   ========================================================= */

function showOrganizationSelection() {

  hideAllAuthScreens();


  const screen =
    getAuthElement(
      "organizationSelectionScreen",
      "organizationSelectScreen"
    );


  if (screen) {

    screen.style.display =
      "flex";

  }


  const appScreen =
    getAuthElement(
      "appScreen"
    );


  if (appScreen) {

    appScreen.style.display =
      "none";

  }

}


/* =========================================================
   職場切り替え
   ========================================================= */

async function switchOrganization(
  organization
) {

  if (
    !organization
  ) {

    return false;

  }


  currentOrganization =
    organization;


  clearLocalAppData();


  try {

    await loadAllFromSupabase();


    showAppScreen();


    renderAll();


    if (
      typeof restartRealtime ===
      "function"
    ) {

      restartRealtime();

    }


    return true;


  } catch (error) {

    console.error(
      "★ 職場切り替えエラー:",
      error
    );


    return false;

  }

}

/* =========================================================
   第16部：Supabaseデータ読み込み
   ========================================================= */


/* =========================================================
   組織ID取得
   ========================================================= */

function getCurrentOrganizationId() {

  if (
    !currentOrganization
  ) {

    return null;

  }


  return (
    currentOrganization.id ||
    currentOrganization.organization_id ||
    null
  );

}


/* =========================================================
   Supabaseデータ読み込み
   ========================================================= */

async function loadAllFromSupabase() {

  if (
    !supabaseClient
  ) {

    console.error(
      "★ Supabase未接続"
    );

    return false;

  }


  const organizationId =
    getCurrentOrganizationId();


  if (
    !organizationId
  ) {

    console.warn(
      "★ organization_id がありません"
    );

    return false;

  }


  try {

    /*
     * 既存の個別読み込み関数がある場合は
     * それを利用する。
     */

    if (
      typeof loadStaffFromSupabase ===
      "function"
    ) {

      await loadStaffFromSupabase(
        organizationId
      );

    }


    if (
      typeof loadShiftTypesFromSupabase ===
      "function"
    ) {

      await loadShiftTypesFromSupabase(
        organizationId
      );

    }


    if (
      typeof loadLeaveTypesFromSupabase ===
      "function"
    ) {

      await loadLeaveTypesFromSupabase(
        organizationId
      );

    }


    if (
      typeof loadCompanyHolidaysFromSupabase ===
      "function"
    ) {

      await loadCompanyHolidaysFromSupabase(
        organizationId
      );

    }


    /*
     * 勤務データ
     */

    await loadWorkShiftsFromSupabase(
      organizationId
    );


    /*
     * 設定
     */

    if (
      typeof loadAppSettingsFromSupabase ===
      "function"
    ) {

      await loadAppSettingsFromSupabase(
        organizationId
      );

    }


    /*
     * ローカルへ保存
     */

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        appData
      )
    );


    return true;


  } catch (error) {

    console.error(
      "★ Supabaseデータ読み込みエラー:",
      error
    );


    return false;

  }

}


/* =========================================================
   勤務データ読み込み
   ========================================================= */

async function loadWorkShiftsFromSupabase(
  organizationId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("work_shifts")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      );


  if (error) {

    console.error(
      "★ work_shifts読み込みエラー:",
      error
    );

    throw error;

  }


  /*
   * 勤務データをアプリ形式へ変換
   */

  appData.shifts =
    {};


  (data || []).forEach(
    row => {

      if (
        !row.work_date ||
        !row.staff_name
      ) {

        return;

      }


      if (
        !appData.shifts[
          row.work_date
        ]
      ) {

        appData.shifts[
          row.work_date
        ] =
          {};

      }


      appData.shifts[
        row.work_date
      ][
        row.staff_name
      ] =
        {

          shift_name:
            row.shift_name || "",

          excel_shift:
            row.excel_shift || "",

          leave_type:
            row.leave_type || "",

          memo:
            row.memo || ""

        };

    }
  );


  return true;

}


/* =========================================================
   データ再読み込み
   ========================================================= */

async function reloadFromSupabase() {

  if (
    cloudOperationBusy ||
    realtimeUpdating
  ) {

    realtimeReloadPending =
      true;

    return;

  }


  realtimeUpdating =
    true;


  try {

    const success =
      await loadAllFromSupabase();


    if (success) {

      renderAll();


      if (
        typeof updateScheduleFixedLayers ===
        "function"
      ) {

        updateScheduleFixedLayers();

      }

    }


  } catch (error) {

    console.error(
      "★ 再読み込みエラー:",
      error
    );

  } finally {

    realtimeUpdating =
      false;


    if (
      realtimeReloadPending
    ) {

      realtimeReloadPending =
        false;


      scheduleRealtimeReload();

    }

  }

}

/* =========================================================
   第17部：勤務保存・変更
   ========================================================= */


/* =========================================================
   勤務データ保存
   ========================================================= */

async function saveWorkShiftToSupabase(
  staffName,
  workDate,
  shiftName,
  excelShift = null,
  leaveType = "",
  memo = ""
) {

  if (
    !supabaseClient
  ) {

    return false;

  }


  const organizationId =
    getCurrentOrganizationId();


  if (
    !organizationId
  ) {

    console.error(
      "★ organization_id がありません"
    );

    return false;

  }


  /*
   * excel_shiftが指定されていない場合
   * shift_nameと同じ値にはしない。
   *
   * 既存データを保持するためnull扱い。
   */

  const row =
    {

      organization_id:
        organizationId,

      staff_name:
        staffName,

      work_date:
        workDate,

      shift_name:
        shiftName || "",

      leave_type:
        leaveType || "",

      memo:
        memo || ""

    };


  /*
   * excel_shiftを明示的に渡された場合のみ更新
   */

  if (
    excelShift !== null &&
    excelShift !== undefined
  ) {

    row.excel_shift =
      excelShift;

  }


  cloudOperationBusy =
    true;


  try {

    const {
      error
    } =
      await supabaseClient
        .from("work_shifts")
        .upsert(
          row,
          {
            onConflict:
              "organization_id,staff_name,work_date"
          }
        );


    if (error) {

      console.error(
        "★ 勤務保存エラー:",
        error
      );

      return false;

    }


    return true;


  } finally {

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

}


/* =========================================================
   勤務削除
   ========================================================= */

async function deleteWorkShiftFromSupabase(
  staffName,
  workDate
) {

  if (
    !supabaseClient
  ) {

    return false;

  }


  const organizationId =
    getCurrentOrganizationId();


  if (
    !organizationId
  ) {

    return false;

  }


  cloudOperationBusy =
    true;


  try {

    const {
      error
    } =
      await supabaseClient
        .from("work_shifts")
        .delete()
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "staff_name",
          staffName
        )
        .eq(
          "work_date",
          workDate
        );


    if (error) {

      console.error(
        "★ 勤務削除エラー:",
        error
      );

      return false;

    }


    return true;


  } finally {

    cloudOperationBusy =
      false;

  }

}


/* =========================================================
   勤務変更共通処理
   ========================================================= */

async function updateWorkShift(
  staffName,
  workDate,
  shiftName,
  excelShift = null,
  leaveType = "",
  memo = ""
) {

  const success =
    await saveWorkShiftToSupabase(
      staffName,
      workDate,
      shiftName,
      excelShift,
      leaveType,
      memo
    );


  if (!success) {

    return false;

  }


  /*
   * ローカルデータも更新
   */

  if (
    !appData.shifts[workDate]
  ) {

    appData.shifts[workDate] =
      {};

  }


  appData.shifts[workDate][staffName] =
    {

      shift_name:
        shiftName || "",

      excel_shift:
        excelShift ?? "",

      leave_type:
        leaveType || "",

      memo:
        memo || ""

    };


  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      appData
    )
  );


  /*
   * 表示更新
   */

  renderAll();


  return true;

}

/* =========================================================
   第18部：Realtime
   ========================================================= */


/* =========================================================
   Realtime変数
   ========================================================= */

let realtimeChannel =
  null;

let realtimeReloadTimer =
  null;


/* =========================================================
   Realtime再読み込み予約
   ========================================================= */

function scheduleRealtimeReload() {

  if (
    realtimeReloadTimer
  ) {

    clearTimeout(
      realtimeReloadTimer
    );

  }


  realtimeReloadTimer =
    setTimeout(
      async () => {

        realtimeReloadTimer =
          null;


        if (
          cloudOperationBusy ||
          realtimeUpdating
        ) {

          realtimeReloadPending =
            true;

          return;

        }


        await reloadFromSupabase();

      },
      300
    );

}


/* =========================================================
   Realtime開始
   ========================================================= */

function setupRealtime() {

  if (
    !supabaseClient
  ) {

    return;

  }


  const organizationId =
    getCurrentOrganizationId();


  if (
    !organizationId
  ) {

    return;

  }


  /*
   * 既存チャンネル削除
   */

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
        "Realtimeチャンネル削除:",
        error
      );

    }

  }


  /*
   * 組織単位で監視
   */

  realtimeChannel =
    supabaseClient
      .channel(
        `work-shifts-${organizationId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "work_shifts",
          filter:
            `organization_id=eq.${organizationId}`
        },
        () => {

          scheduleRealtimeReload();

        }
      )
      .subscribe(
        status => {

          console.log(
            "★ Realtime:",
            status
          );

        }
      );

}


/* =========================================================
   Realtime停止
   ========================================================= */

function stopRealtime() {

  if (
    realtimeReloadTimer
  ) {

    clearTimeout(
      realtimeReloadTimer
    );

    realtimeReloadTimer =
      null;

  }


  if (
    realtimeChannel &&
    supabaseClient
  ) {

    try {

      supabaseClient
        .removeChannel(
          realtimeChannel
        );

    } catch (error) {

      console.warn(
        "Realtime停止エラー:",
        error
      );

    }

  }


  realtimeChannel =
    null;

}


/* =========================================================
   Realtime再起動
   ========================================================= */

function restartRealtime() {

  stopRealtime();

  setupRealtime();

}


/* =========================================================
   タブ復帰時同期
   ========================================================= */

function setupVisibilitySync() {

  if (
    window.__shiftVisibilitySync
  ) {

    return;

  }


  window.__shiftVisibilitySync =
    true;


  document.addEventListener(
    "visibilitychange",
    () => {

      if (
        document.visibilityState ===
        "visible"
      ) {

        scheduleRealtimeReload();

      }

    }
  );

}

/* =========================================================
   第19部：勤務表機能初期化
   ========================================================= */


/* =========================================================
   ログイン後初期化
   ========================================================= */

async function initializeAfterLogin() {

  console.log(
    "★ ログイン後初期化"
  );


  /*
   * Supabaseからデータ取得
   */

  const loaded =
    await loadAllFromSupabase();


  if (!loaded) {

    console.warn(
      "★ サーバーデータ読み込みに失敗"
    );

  }


  /*
   * 既存のイベント登録
   */

  if (
    typeof bindEvents ===
    "function"
  ) {

    bindEvents();

  }


  /*
   * その他の既存セットアップ
   */

  if (
    typeof setupNavigation ===
    "function"
  ) {

    setupNavigation();

  }


  if (
    typeof setupScheduleEvents ===
    "function"
  ) {

    setupScheduleEvents();

  }


  if (
    typeof setupStaffSettings ===
    "function"
  ) {

    setupStaffSettings();

  }


  if (
    typeof setupShiftTypeSettings ===
    "function"
  ) {

    setupShiftTypeSettings();

  }


  if (
    typeof setupLeaveSettings ===
    "function"
  ) {

    setupLeaveSettings();

  }


  if (
    typeof setupCompanyHolidaySettings ===
    "function"
  ) {

    setupCompanyHolidaySettings();

  }


  /*
   * 表示
   */

  if (
    typeof renderAll ===
    "function"
  ) {

    renderAll();

  }


  /*
   * Realtime
   */

  setupRealtime();


  setupVisibilitySync();


  /*
   * 自動同期
   */

  if (
    typeof startAutoSync ===
    "function"
  ) {

    startAutoSync();

  }


  /*
   * 固定レイヤー
   */

  if (
    typeof updateScheduleFixedLayers ===
    "function"
  ) {

    setTimeout(
      () => {

        updateScheduleFixedLayers();

      },
      100
    );

  }


  console.log(
    "★ ログイン後初期化完了"
  );

}

