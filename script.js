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
   初期読み込み画面
================================================== */

/* =========================================================
   初期ローディング画面
========================================================= */

function showInitialLoading(
  message = "データを取得しています…"
) {

  /* =================================================
     ローディング画面
  ================================================= */

  const loading =
    document.getElementById(
      "loadingScreen"
    );


  if (!loading) return;


  /* -------------------------------------------------
     メッセージ
  ------------------------------------------------- */

  const text =
    loading.querySelector(
      ".loadingText"
    );


  if (text) {

    text.textContent =
      message;

  }


  /* =================================================
     ログイン画面を完全に隠す
     
     Google / Apple / Azureから戻った直後に
     ログイン画面が見えないようにする
  ================================================= */

  const loginPage =
    document.getElementById(
      "loginPage"
    );


  if (loginPage) {

    loginPage.style.setProperty(
      "display",
      "none",
      "important"
    );

    loginPage.style.setProperty(
      "visibility",
      "hidden",
      "important"
    );

    loginPage.style.setProperty(
      "opacity",
      "0",
      "important"
    );

    loginPage.style.setProperty(
      "pointer-events",
      "none",
      "important"
    );

  }


  /* =================================================
     アプリ本体もまだ表示しない
  ================================================= */

  const app =
    document.getElementById(
      "app"
    );


  if (app) {

    app.style.visibility =
      "hidden";

    app.style.opacity =
      "0";

    app.style.pointerEvents =
      "none";

  }


  /* =================================================
     ローディングを最前面に表示
  ================================================= */

  loading.style.setProperty(
    "display",
    "flex",
    "important"
  );

  loading.style.setProperty(
    "visibility",
    "visible",
    "important"
  );

  loading.style.setProperty(
    "opacity",
    "1",
    "important"
  );

  loading.style.setProperty(
    "pointer-events",
    "auto",
    "important"
  );

  loading.style.setProperty(
    "z-index",
    "999999",
    "important"
  );

}


/* ---------------------------------------------------------
   初期ローディングを隠す
--------------------------------------------------------- */

function hideInitialLoading() {

  const loading =
    document.getElementById(
      "loadingScreen"
    );


  if (loading) {

    loading.style.setProperty(
      "display",
      "none",
      "important"
    );

    loading.style.setProperty(
      "visibility",
      "hidden",
      "important"
    );

    loading.style.setProperty(
      "opacity",
      "0",
      "important"
    );

    loading.style.setProperty(
      "pointer-events",
      "none",
      "important"
    );

  }

}
/* ==================================================
   初期化
================================================== */

/*
   DOMの読み込み状態に関係なく
   必ずinit()を1回だけ実行する
*/

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      init();
    },
    {
      once: true
    }
  );

} else {

  init();

}

/* ==================================================
   初期化
================================================== */

async function init() {

  try {

    console.log(
      "★ 勤務表アプリ起動"
    );


    /* --------------------------------------------------
       初期ローディング表示
    -------------------------------------------------- */

    showInitialLoading(
      "Shift+を読み込んでいます…"
    );


    /* --------------------------------------------------
       OAuthログイン中か確認
    -------------------------------------------------- */

    const oauthLoginInProgress =
      sessionStorage.getItem(
        "oauthLoginInProgress"
      ) === "true";


    /* --------------------------------------------------
       Supabase初期化
    -------------------------------------------------- */

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


    window.shiftSupabaseClient =
      supabaseClient;


    /* ==================================================
       パスワード再設定状態を監視
    ================================================== */

    supabaseClient.auth.onAuthStateChange(
      async (
        event,
        session
      ) => {

        console.log(
          "★ Auth状態変化:",
          event
        );


        /*
         * パスワード再設定メールから
         * 戻ってきた場合
         */

        if (
          event ===
          "PASSWORD_RECOVERY"
        ) {

          console.log(
            "★ PASSWORD_RECOVERYを検出"
          );


          showLoginPage();


          const loginMainView =
            document.getElementById(
              "loginMainView"
            );


          const passwordResetView =
            document.getElementById(
              "passwordResetView"
            );


          const passwordUpdateView =
            document.getElementById(
              "passwordUpdateView"
            );


          if (loginMainView) {

            loginMainView.style.display =
              "none";

          }


          if (passwordResetView) {

            passwordResetView.style.display =
              "none";

          }


          if (passwordUpdateView) {

            passwordUpdateView.style.display =
              "block";

          }


          if (
            typeof setupPasswordUpdate ===
            "function"
          ) {

            setupPasswordUpdate();

          }


          hideInitialLoading();


          console.log(
            "★ 新しいパスワード入力画面を表示"
          );

        }

      }
    );


    /* --------------------------------------------------
       現在のURL
    -------------------------------------------------- */

    const currentUrl =
      new URL(
        window.location.href
      );


    /* --------------------------------------------------
       URLから招待トークン取得
    -------------------------------------------------- */

    const currentUrlInviteToken =
      currentUrl.searchParams.get(
        "invite"
      );


    /* --------------------------------------------------
       招待URLならログイン前にも保存
    -------------------------------------------------- */

    if (
      currentUrlInviteToken
    ) {

      console.log(
        "★ init: 招待トークンを保存"
      );


      sessionStorage.setItem(
        "pendingInviteToken",
        currentUrlInviteToken
      );


      localStorage.setItem(
        "pendingInviteToken",
        currentUrlInviteToken
      );

    }


    /* ==================================================
       強制ログイン画面
    ================================================== */

    const forceLoginScreen =
      sessionStorage.getItem(
        "forceLoginScreen"
      ) === "true";


    if (forceLoginScreen) {

      console.log(
        "★ 強制ログイン画面"
      );


      sessionStorage.removeItem(
        "forceLoginScreen"
      );


      await supabaseClient.auth.signOut();


      showLoginPage();


      if (
        typeof setupGoogleLogin ===
        "function"
      ) {

        setupGoogleLogin();

      }


      if (
        typeof setupAppleLogin ===
        "function"
      ) {

        setupAppleLogin();

      }


      if (
        typeof setupAzureLogin ===
        "function"
      ) {

        setupAzureLogin();

      }


      if (
        typeof setupPasskeyLogin ===
        "function"
      ) {

        setupPasskeyLogin();

      }


      if (
        typeof setupEmailLogin ===
        "function"
      ) {

        setupEmailLogin();

      }


      if (
        typeof setupPasswordReset ===
        "function"
      ) {

        setupPasswordReset();

      }


      if (
        typeof setupNewOrganizationButton ===
        "function"
      ) {

        setupNewOrganizationButton();

      }


      hideInitialLoading();


      return;

    }


    /* ==================================================
       現在のセッション取得
    ================================================== */

    let {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();


    /* ==================================================
       パスワード再設定URL確認
    ================================================== */

    const isPasswordReset =
      currentUrl.searchParams.get(
        "password-reset"
      ) === "true";

/* ==================================================
   パスワード再設定リンクのエラー確認
================================================== */

const hashParams =
  new URLSearchParams(
    window.location.hash.substring(1)
  );

const passwordResetError =
  hashParams.get("error");

const passwordResetErrorCode =
  hashParams.get("error_code");

const passwordResetErrorDescription =
  hashParams.get("error_description");


if (
  isPasswordReset &&
  passwordResetError
) {

  console.error(
    "★ パスワード再設定リンクエラー",
    {
      error:
        passwordResetError,

      error_code:
        passwordResetErrorCode,

      error_description:
        passwordResetErrorDescription
    }
  );

  showLoginPage();

  const loginMainView =
    document.getElementById(
      "loginMainView"
    );

  const passwordResetView =
    document.getElementById(
      "passwordResetView"
    );

  const passwordUpdateView =
    document.getElementById(
      "passwordUpdateView"
    );

  if (loginMainView) {
    loginMainView.style.display =
      "none";
  }

  if (passwordResetView) {
    passwordResetView.style.display =
      "none";
  }

  if (passwordUpdateView) {
    passwordUpdateView.style.display =
      "block";
  }

  if (
    typeof setupPasswordUpdate ===
    "function"
  ) {
    setupPasswordUpdate();
  }

  const message =
    document.getElementById(
      "passwordUpdateMessage"
    );

  if (message) {

    if (
      passwordResetErrorCode ===
      "otp_expired"
    ) {

      message.textContent =
        "パスワード再設定リンクの有効期限が切れているか、すでに使用されています。もう一度再設定メールを送信してください。";

    } else {

      message.textContent =
        passwordResetErrorDescription ||
        "パスワード再設定リンクを確認できませんでした。";

    }

  }

  hideInitialLoading();

  return;

}


    if (isPasswordReset) {

      console.log(
        "★ パスワード再設定URLを検出"
      );


      /*
       * Recoveryセッション取得待機
       */

      if (!session) {

        console.log(
          "★ Recoveryセッション待機"
        );


        for (
          let i = 0;
          i < 20;
          i++
        ) {

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                150
              )
          );


          const recoveryResult =
            await supabaseClient.auth.getSession();


          session =
            recoveryResult?.data?.session ||
            null;


          if (session) {

            console.log(
              "★ Recoveryセッション取得成功",
              i + 1
            );

            break;

          }

        }

      }


      /*
       * ログイン画面を表示
       */

      showLoginPage();


      const loginMainView =
        document.getElementById(
          "loginMainView"
        );


      const passwordResetView =
        document.getElementById(
          "passwordResetView"
        );


      const passwordUpdateView =
        document.getElementById(
          "passwordUpdateView"
        );


      if (loginMainView) {

        loginMainView.style.display =
          "none";

      }


      if (passwordResetView) {

        passwordResetView.style.display =
          "none";

      }


      if (passwordUpdateView) {

        passwordUpdateView.style.display =
          "block";

      }


      if (
        typeof setupPasswordUpdate ===
        "function"
      ) {

        setupPasswordUpdate();

      }


      hideInitialLoading();


      console.log(
        "★ パスワード再設定画面表示完了"
      );


      /*
       * 通常のログイン・職場読み込み処理には進まない
       */

      return;

    }


    /* ==================================================
       OAuthから戻った直後のセッション待機
    ================================================== */

    if (
      !session &&
      oauthLoginInProgress
    ) {

      console.log(
        "★ OAuth戻り直後：セッション待機"
      );


      for (
        let i = 0;
        i < 20;
        i++
      ) {

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              150
            )
        );


        const result =
          await supabaseClient.auth.getSession();


        session =
          result.data.session;


        if (session) {

          console.log(
            "★ OAuthセッション取得成功",
            i + 1
          );

          break;

        }

      }

    }


    /* ==================================================
       未ログイン
    ================================================== */

    if (!session) {

      console.log(
        "★ 未ログイン"
      );


      showLoginPage();


      if (
        typeof setupGoogleLogin ===
        "function"
      ) {

        setupGoogleLogin();

      }


      if (
        typeof setupAppleLogin ===
        "function"
      ) {

        setupAppleLogin();

      }


      if (
        typeof setupAzureLogin ===
        "function"
      ) {

        setupAzureLogin();

      }


      if (
        typeof setupPasskeyLogin ===
        "function"
      ) {

        setupPasskeyLogin();

      }


      if (
        typeof setupEmailLogin ===
        "function"
      ) {

        setupEmailLogin();

      }


      if (
        typeof setupPasswordReset ===
        "function"
      ) {

        setupPasswordReset();

      }


      if (
        typeof setupNewOrganizationButton ===
        "function"
      ) {

        setupNewOrganizationButton();

      }


      hideInitialLoading();


      return;

    }


    /* --------------------------------------------------
       OAuthログイン中フラグを削除
    -------------------------------------------------- */

    sessionStorage.removeItem(
      "oauthLoginInProgress"
    );


    console.log(
      "★ ログイン済み",
      session.user.id
    );


    /* ==================================================
       招待処理
       ★ 必ず職場取得より先に実行
    ================================================== */

    let inviteToken = null;


    /* --------------------------------------------------
       招待URLから来た場合のみ招待処理を行う
    -------------------------------------------------- */

    if (
      currentUrlInviteToken
    ) {

      if (
        typeof getPendingInviteToken ===
        "function"
      ) {

        inviteToken =
          getPendingInviteToken();

      } else {

        inviteToken =
          currentUrlInviteToken;

      }

    }


    if (inviteToken) {

      console.log(
        "★ 招待トークンを検出"
      );


      if (
        typeof handleInviteAfterLogin !==
        "function"
      ) {

        throw new Error(
          "handleInviteAfterLogin が見つかりません"
        );

      }


      try {

        const inviteAccepted =
          await handleInviteAfterLogin(
            inviteToken
          );


        console.log(
          "★ 招待処理完了",
          inviteAccepted
        );


      } catch (inviteError) {

        console.error(
          "★ 招待登録失敗",
          inviteError
        );


        /*
         * 招待登録に失敗した場合は、
         * 所属なしの状態で先へ進ませない。
         */

        await supabaseClient.auth.signOut();


        showLoginPage();


        if (
          typeof setupGoogleLogin ===
          "function"
        ) {

          setupGoogleLogin();

        }


        if (
          typeof setupAppleLogin ===
          "function"
        ) {

          setupAppleLogin();

        }


        if (
          typeof setupAzureLogin ===
          "function"
        ) {

          setupAzureLogin();

        }


        if (
          typeof setupPasskeyLogin ===
          "function"
        ) {

          setupPasskeyLogin();

        }


        if (
          typeof setupEmailLogin ===
          "function"
        ) {

          setupEmailLogin();

        }


        if (
          typeof setupPasswordReset ===
          "function"
        ) {

          setupPasswordReset();

        }


        if (
          typeof setupNewOrganizationButton ===
          "function"
        ) {

          setupNewOrganizationButton();

        }


        hideInitialLoading();


        alert(
          "招待登録に失敗しました。\n\n" +
          (
            inviteError?.message ||
            inviteError
          )
        );


        return;

      }

    }


    /* ==================================================
       新規職場登録の続き
    ================================================== */

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
    "★ 保留中の新規職場登録を処理します"
  );


  const {
    data,
    error
  } = await supabaseClient.rpc(
    "create_organization_and_admin",
    {
      new_org_name:
        pendingOrganizationName,

      new_staff_name:
        pendingStaffName
    }
  );


  if (error) {

    console.error(
      "★ 職場作成RPCエラー:",
      error
    );

    throw error;
  }


  /*
     RPCが成功した時点で
     保留情報を削除する。

     これにより、組織情報取得時に
     一時的なエラーが発生しても、
     同じ職場を二重作成しにくくする。
  */

  sessionStorage.removeItem(
    "pendingOrganizationName"
  );

  sessionStorage.removeItem(
    "pendingStaffName"
  );


  currentOrganization =
    await getCurrentOrganization(
      session.user.id
    );


   updateScheduleNavByRole();

  if (!currentOrganization) {

    throw new Error(
      "職場登録後の組織情報を取得できませんでした。"
    );

  }


  console.log(
    "★ 新規職場登録完了:",
    currentOrganization
  );


  alert(
    "職場を登録しました。"
  );

}

    /* ==================================================
       職場所属取得
    ================================================== */

    console.log(
      "★ 職場所属を取得します"
    );


    currentOrganization =
      await getCurrentOrganization(
        session.user.id
      );


    if (!currentOrganization) {

      console.error(
        "★ 所属職場なし"
      );


      await supabaseClient.auth.signOut();


      showLoginPage();


      if (
        typeof setupGoogleLogin ===
        "function"
      ) {

        setupGoogleLogin();

      }


      if (
        typeof setupAppleLogin ===
        "function"
      ) {

        setupAppleLogin();

      }


      if (
        typeof setupAzureLogin ===
        "function"
      ) {

        setupAzureLogin();

      }


      if (
        typeof setupPasskeyLogin ===
        "function"
      ) {

        setupPasskeyLogin();

      }


      if (
        typeof setupEmailLogin ===
        "function"
      ) {

        setupEmailLogin();

      }


      if (
        typeof setupPasswordReset ===
        "function"
      ) {

        setupPasswordReset();

      }


      if (
        typeof setupNewOrganizationButton ===
        "function"
      ) {

        setupNewOrganizationButton();

      }


      hideInitialLoading();


      alert(
        "所属している職場が見つかりません。"
      );


      return;

    }


    console.log(
      "★ 現在の職場",
      currentOrganization
    );


    /* ==================================================
       職場名表示
    ================================================== */

    const organizationTitle =
      document.getElementById(
        "organizationTitle"
      );


    if (organizationTitle) {

      organizationTitle.textContent =
        currentOrganization.name;

    }


    /* ==================================================
       管理者設定
    ================================================== */

    setupOrganizationDangerZone();


    /* ==================================================
       ローカルデータ
    ================================================== */

    loadLocalData();


    /* ==================================================
       イベント設定
    ================================================== */

    bindEvents();


    /* ==================================================
       ログアウト
    ================================================== */

    setupLogoutButton();


    /* ==================================================
       Supabaseデータ読み込み
    ================================================== */

    await loadAllFromSupabase();


    /* ==================================================
       画面描画
    ================================================== */

    renderAll();


    /* ==================================================
       アプリ表示
    ================================================== */

    showApp();


    /* ==================================================
       公休日
    ================================================== */

    loadPublicHolidays();


    /* ==================================================
       Realtime
    ================================================== */

    setupRealtime();


    /* ==================================================
       自動同期
    ================================================== */

    startAutoSync();


    /* ==================================================
       画面復帰同期
    ================================================== */

    setupVisibilitySync();


    /* ==================================================
       ダークモード
    ================================================== */

    setupDarkMode();


    /* ==================================================
       初期ローディング終了
    ================================================== */

    hideInitialLoading();


    console.log(
      "★ Shift+起動完了"
    );


  } catch (error) {

    /* ==================================================
       初期化エラー
    ================================================== */

    console.error(
      "★ 初期化エラー",
      error
    );


    hideInitialLoading();


    /*
      ここでも各関数を直接呼ばず、
      存在確認してから実行する。
    */

    try {

      showLoginPage();

    } catch (loginPageError) {

      console.error(
        "★ ログイン画面表示エラー",
        loginPageError
      );

    }


    try {

      if (
        typeof setupGoogleLogin ===
        "function"
      ) {

        setupGoogleLogin();

      }

    } catch (googleError) {

      console.error(
        "★ Googleログイン設定エラー",
        googleError
      );

    }


    try {

      if (
        typeof setupAppleLogin ===
        "function"
      ) {

        setupAppleLogin();

      }

    } catch (appleError) {

      console.error(
        "★ Appleログイン設定エラー",
        appleError
      );

    }


    try {

      if (
        typeof setupAzureLogin ===
        "function"
      ) {

        setupAzureLogin();

      }

    } catch (azureError) {

      console.error(
        "★ Azureログイン設定エラー",
        azureError
      );

    }


    try {

      if (
        typeof setupPasskeyLogin ===
        "function"
      ) {

        setupPasskeyLogin();

      }

    } catch (passkeyError) {

      console.error(
        "★ Passkeyログイン設定エラー",
        passkeyError
      );

    }


    /* --------------------------------------------------
       メールアドレスログイン設定
    -------------------------------------------------- */

    try {

      if (
        typeof setupEmailLogin ===
        "function"
      ) {

        setupEmailLogin();

      }

    } catch (emailError) {

      console.error(
        "★ メールログイン設定エラー",
        emailError
      );

    }


    /* --------------------------------------------------
       パスワード初期化設定
    -------------------------------------------------- */

    try {

      if (
        typeof setupPasswordReset ===
        "function"
      ) {

        setupPasswordReset();

      }

    } catch (passwordResetError) {

      console.error(
        "★ パスワード初期化設定エラー",
        passwordResetError
      );

    }


    /* --------------------------------------------------
       新しいパスワード設定
    -------------------------------------------------- */

    try {

      if (
        typeof setupPasswordUpdate ===
        "function"
      ) {

        setupPasswordUpdate();

      }

    } catch (passwordUpdateError) {

      console.error(
        "★ パスワード変更設定エラー",
        passwordUpdateError
      );

    }


    try {

      if (
        typeof setupNewOrganizationButton ===
        "function"
      ) {

        setupNewOrganizationButton();

      }

    } catch (organizationButtonError) {

      console.error(
        "★ 新規職場登録ボタン設定エラー",
        organizationButtonError
      );

    }


    alert(
      "Shift+の起動に失敗しました。\n\n" +
      (
        error?.message ||
        error
      )
    );

  }

}

/* ==================================================
   OAuth復帰後のセッション待機
================================================== */

async function waitForAuthSession() {

  return new Promise(
    resolve => {

      let finished =
        false;


      let subscription =
        null;


      let timeoutId =
        null;


      const finish =
        session => {

          if (finished) {

            return;

          }


          finished = true;


          if (timeoutId) {

            clearTimeout(
              timeoutId
            );

          }


          if (subscription) {

            subscription.unsubscribe();

          }


          resolve(
            session ||
            null
          );

        };


      /* ------------------------------------------------
         Auth状態変化を監視
      ------------------------------------------------ */

      const result =
        supabaseClient
          .auth
          .onAuthStateChange(
            (
              event,
              session
            ) => {

              console.log(
                "★ Auth状態変化:",
                event,
                session
              );


              /*
               * OAuthから戻って
               * SIGNED_INになった場合
               */

              if (
                event ===
                "SIGNED_IN"
              ) {

                finish(
                  session
                );

                return;

              }


              /*
               * INITIAL_SESSIONで
               * 既にログイン済みの場合
               */

              if (
                event ===
                  "INITIAL_SESSION" &&
                session
              ) {

                finish(
                  session
                );

              }

            }
          );


      subscription =
        result
          ?.data
          ?.subscription ||
        null;


      /* ------------------------------------------------
         念のため定期的にセッション確認
         
         OAuth復帰時にAuthStateChangeを
         取り逃した場合への対策
      ------------------------------------------------ */

      let checkCount =
        0;


      const maxCheckCount =
        30;


      const checkSession =
        async () => {

          if (finished) {

            return;

          }


          checkCount++;


          try {

            const {
              data,
              error
            } =
              await supabaseClient
                .auth
                .getSession();


            if (error) {

              console.warn(
                "セッション再確認エラー",
                error
              );

            }


            if (
              data?.session
            ) {

              console.log(
                "★ セッションを再確認できました"
              );


              finish(
                data.session
              );


              return;

            }

          } catch (error) {

            console.warn(
              "セッション確認中エラー",
              error
            );

          }


          if (
            checkCount >=
            maxCheckCount
          ) {

            console.log(
              "★ セッション待機タイムアウト"
            );


            finish(
              null
            );


            return;

          }


          setTimeout(
            checkSession,
            500
          );

        };


      /*
       * 500ms後から確認開始
       */
      setTimeout(
        checkSession,
        500
      );


      /* ------------------------------------------------
         最終タイムアウト
         約15秒
      ------------------------------------------------ */

      timeoutId =
        setTimeout(
          async () => {

            if (finished) {

              return;

            }


            console.log(
              "★ Auth監視最終確認"
            );


            try {

              const {
                data
              } =
                await supabaseClient
                  .auth
                  .getSession();


              finish(
                data?.session ||
                null
              );

            } catch (error) {

              console.error(
                "最終セッション確認エラー",
                error
              );


              finish(
                null
              );

            }

          },
          15000
        );

    }
  );

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
    console.error("Passkeyログインエラー", error);

    const errorMessage =
      error?.message || String(error);

    const lowerMessage =
      errorMessage.toLowerCase();

    /*
     * Face ID / 指紋認証をユーザーがキャンセルした場合は
     * エラー表示しない
     */
    const isUserCancel =
      error?.name === "NotAllowedError" ||
      error?.name === "AbortError" ||
      lowerMessage.includes("cancel") ||
      lowerMessage.includes("abort") ||
      lowerMessage.includes("not allowed by the user agent") ||
      lowerMessage.includes("the request is not allowed");

    if (!isUserCancel) {
      alert(
        "Face ID / 指紋ログインに失敗しました。\n\n" +
        errorMessage
      );
    }

    if (message) {
      message.textContent =
        "Face ID / 指紋でログインできます。";
    }

    if (button) {
      button.disabled = false;
      button.style.opacity = "1";
      button.innerHTML =
        '<span style="font-size:20px;">🔐</span>' +
        'Face ID / 指紋でログイン';
    }
  }

}

function updateScheduleNavByRole() {

  const scheduleButton =
    document.getElementById(
      "scheduleNavButton"
    );

  if (!scheduleButton) {
    return;
  }

  /*
   * 管理者
   * → 勤務表ボタンを表示
   */
  if (
    currentOrganization &&
    currentOrganization.role === "admin"
  ) {

    scheduleButton.style.display = "";

    return;

  }


  /*
   * 職員
   * → 勤務表ボタンを非表示
   */
  if (
    currentOrganization &&
    currentOrganization.role !== "admin"
  ) {

    scheduleButton.style.display = "none";

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
  console.log(
    "★ Passkey登録処理開始"
  );
  try {
    /*
     * Passkey対応確認
     */
    console.log(
      "★ Passkeyチェック① PublicKeyCredential:",
      !!window.PublicKeyCredential
    );
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
    console.log(
      "★ Passkeyチェック② セッション取得開始"
    );
    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();
    console.log(
      "★ Passkeyチェック② session:",
      session
    );
    if (!session) {
      console.log(
        "ログインしていないためPasskey登録を行いません"
      );
      return;
    }
    /*
     * 現在のユーザー確認
     */
    console.log(
      "★ Passkey登録対象ユーザー:",
      session.user?.id,
      session.user?.email
    );
    /*
     * すでにPasskeyが登録されているか確認
     */
    console.log(
      "★ Passkeyチェック③ Passkey一覧取得開始"
    );
    const {
      data: passkeys,
      error: listError
    } =
      await supabaseClient.auth.passkey.list();
    console.log(
      "★ Passkeyチェック③ 結果:",
      passkeys,
      listError
    );
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
    console.log(
      "★ Passkey未登録です"
    );
    /*
     * Passkey登録を確認
     */
    const register =
      confirm(
        "次回から、Face ID・指紋などで\n" +
        "勤務表にログインできるようにしますか？\n\n" +
        "この端末にPasskeyを登録します。"
      );
    console.log(
      "★ Passkey登録確認結果:",
      register
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
      "★ Passkey登録エラー",
      error
    );
    const errorMessage =
      error?.message ||
      String(error);
    const lowerMessage =
      errorMessage.toLowerCase();
    /*
     * ユーザーがFace ID等を
     * キャンセルした場合は
     * エラー画面を出さない
     */
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

    /* ==================================================
       招待発行前の確認
    ================================================== */

    


    /* ==================================================
       招待リンク発行
    ================================================== */

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

function showLoginPage(message = "") {

  console.log("ログイン画面を表示");

hideInitialLoading();
  /* =====================================================
     ① アプリ本体を完全に隠す
     ===================================================== */

  const app =
    document.getElementById("app");

  if (app) {

    app.style.setProperty(
      "display",
      "none",
      "important"
    );

    app.style.setProperty(
      "visibility",
      "hidden",
      "important"
    );

    app.style.setProperty(
      "opacity",
      "0",
      "important"
    );

    app.style.setProperty(
      "pointer-events",
      "none",
      "important"
    );
  }


  /* =====================================================
     ② ログイン画面を表示
     ===================================================== */

  const loginPage =
    document.getElementById("loginPage");

  if (loginPage) {

    loginPage.style.setProperty(
      "display",
      "flex",
      "important"
    );

    loginPage.style.setProperty(
      "visibility",
      "visible",
      "important"
    );

    loginPage.style.setProperty(
      "opacity",
      "1",
      "important"
    );

    loginPage.style.setProperty(
      "pointer-events",
      "auto",
      "important"
    );
  }


  /* =====================================================
     ③ ログインメッセージ
     ===================================================== */

  const loginMessage =
    document.getElementById("loginMessage");

  if (loginMessage) {

    loginMessage.textContent =
      message || "";

  }


  /* =====================================================
     ④ 画面を一番上へ
     ===================================================== */

  window.scrollTo(0, 0);

  if (loginPage) {
    loginPage.scrollTop = 0;
  }
}

async function logout() {

  console.log("★ ログアウト開始");

  try {

    /* =====================================================
       ① 次回起動時にログイン画面を表示するフラグを設定
       ===================================================== */

    sessionStorage.setItem(
      "forceLoginScreen",
      "true"
    );


    /* =====================================================
       ② Supabaseからログアウト
       ===================================================== */

    const {
      data: { session }
    } =
      await supabaseClient.auth.getSession();

    console.log(
      "★ 現在のセッション：",
      session
    );


    if (session) {

      const { error } =
        await supabaseClient.auth.signOut({
          scope: "global"
        });


      if (error) {

        console.error(
          "★ Supabaseログアウトエラー",
          error
        );

        /*
         * すでにログアウト済みなら
         * そのままログイン画面へ進む
         */
        if (
          !String(error.message).includes(
            "Auth session missing"
          )
        ) {

          throw error;

        }

      } else {

        console.log(
          "★ Supabaseログアウト成功"
        );

      }

    } else {

      console.log(
        "★ セッションなし → ログアウト済み"
      );

    }


    /* =====================================================
       ③ 現在の組織情報をクリア
       ===================================================== */

    currentOrganization = null;


    /* =====================================================
       ④ ページを再読み込み
       
       → init() が実行される
       → forceLoginScreen === "true"
       → ログイン画面を表示
       ===================================================== */

    console.log(
      "★ ログアウト完了 → ログイン画面へ移動"
    );

    window.location.reload();


  } catch (error) {

    console.error(
      "★ ログアウト処理エラー",
      error
    );


    /*
     * エラーになった場合は、
     * ログイン画面フラグを解除
     */
    sessionStorage.removeItem(
      "forceLoginScreen"
    );


    alert(
      "ログアウトに失敗しました。\n\n" +
      "エラー：" +
      (error?.message || String(error))
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

      console.log(
        "★ ログアウト開始"
      );


      /* =================================================
         ① ログアウト後はログイン画面を表示する
         ================================================= */

      sessionStorage.setItem(
        "forceLoginScreen",
        "true"
      );


      /* =================================================
         ② 現在の職場情報を消す
         ================================================= */

      currentOrganization = null;


      /* =================================================
         ③ アプリ内のローカルデータを消す
         ================================================= */

      localStorage.removeItem(
        STORAGE_KEY
      );


      /* =================================================
         ④ 新規職場登録途中の情報を消す
         ================================================= */

      sessionStorage.removeItem(
        "pendingOrganizationName"
      );

      sessionStorage.removeItem(
        "pendingStaffName"
      );


      /* =================================================
         ⑤ Supabaseからログアウト
         ================================================= */

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


      /* =================================================
         ⑥ セッション確認
         ================================================= */

      const {
        data: {
          session
        }
      } =
        await supabaseClient.auth.getSession();


      if (session) {

        console.warn(
          "⚠️ セッションがまだ残っています"
        );

      } else {

        console.log(
          "★ セッション完全消去確認"
        );

      }


      /* =================================================
         ⑦ ページを再読み込み
         
         init() が実行され、
         forceLoginScreen === "true"
         を検出してログイン画面を表示する
         ================================================= */

      console.log(
        "★ ログイン画面へ移動します"
      );


      window.location.reload();

    }


    catch (error) {

      console.error(
        "ログアウトエラー",
        error
      );


      /*
       * エラーの場合は
       * ログイン画面フラグを解除
       */

      sessionStorage.removeItem(
        "forceLoginScreen"
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
     * 現在のSupabaseクライアント
     *
     * Googleログインなどと同じクライアントを使用する
     */

    const client =
      window.shiftSupabaseClient ||
      supabaseClient;


    if (!client) {

      throw new Error(
        "Supabaseが初期化されていません。"
      );

    }


    /*
     * 現在のログインセッション確認
     */

    console.log(
      "★ 職場削除前：ログインセッション確認"
    );


    const {
      data: sessionData,
      error: sessionError
    } =
      await client.auth.getSession();


    if (sessionError) {

      console.error(
        "★ セッション取得エラー",
        sessionError
      );

      throw sessionError;

    }


    const session =
      sessionData?.session;


    if (!session) {

      console.error(
        "★ 職場削除時にログインセッションがありません"
      );

      throw new Error(
        "ログイン情報を取得できませんでした。"
      );

    }


    console.log(
      "★ 職場削除：ログインセッション取得成功",
      {
        userId:
          session.user?.id,

        email:
          session.user?.email
      }
    );


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

      await client.auth.signOut();

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
     * ログイン・新規登録ボタンを再設定
     */

    setupGoogleLogin();

    setupEmailLogin();

    setupAppleLogin();

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


  /* =====================================================
     ログイン画面を完全に非表示
  ===================================================== */

  if (loginPage) {

    loginPage.style.setProperty(
      "display",
      "none",
      "important"
    );

    loginPage.style.setProperty(
      "visibility",
      "hidden",
      "important"
    );

    loginPage.style.setProperty(
      "opacity",
      "0",
      "important"
    );

    loginPage.style.setProperty(
      "pointer-events",
      "none",
      "important"
    );

  }


  /* =====================================================
     アプリを表示
  ===================================================== */

  if (app) {

    app.style.display =
      "";

    app.style.visibility =
      "visible";

    app.style.opacity =
      "1";

    app.style.pointerEvents =
      "auto";

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

/* =========================================================
   Appleログイン
========================================================= */

async function loginWithApple() {

  const button =
    document.getElementById("appleLoginButton");

  try {

    if (button) {
      button.disabled = true;
    }

      showInitialLoading(
      "Appleでログインしています…"
    );

    const params =
      new URLSearchParams(window.location.search);

    const inviteToken =
      params.get("invite");

    if (inviteToken) {

      sessionStorage.setItem(
        "pendingInviteToken",
        inviteToken
      );

    }

    let redirectTo =
      "https://mya24950-dotcom.github.io/kinmu-app/";

    if (inviteToken) {

      redirectTo +=
        "?invite=" +
        encodeURIComponent(inviteToken);

    }

    console.log(
      "★ Apple OAuth開始",
      redirectTo
    );

    const {
      error
    } =
      client.auth.signInWithOAuth({

        provider: "apple",

        options: {
          redirectTo
        }

      });

    if (error) {
      throw error;
    }

  } catch (error) {

    console.error(
      "Appleログインエラー:",
      error
    );

    sessionStorage.removeItem(
      "oauthLoginInProgress"
    );

    hideInitialLoading();

    if (button) {
      button.disabled = false;
    }

    alert(
      "Appleログインに失敗しました。\n" +
      (error.message || error)
    );

  }

}

async function updatePassword() {

  const passwordInput =
    document.getElementById(
      "newPassword"
    );

  const confirmInput =
    document.getElementById(
      "newPasswordConfirm"
    );

  const message =
    document.getElementById(
      "passwordUpdateMessage"
    );

  const button =
    document.getElementById(
      "updatePasswordButton"
    );


  const password =
    passwordInput?.value || "";

  const confirmPassword =
    confirmInput?.value || "";


  if (!password) {

    if (message) {

      message.textContent =
        "新しいパスワードを入力してください。";

    }

    return;

  }


  if (password.length < 6) {

    if (message) {

      message.textContent =
        "パスワードは6文字以上で設定してください。";

    }

    return;

  }


  if (
    password !==
    confirmPassword
  ) {

    if (message) {

      message.textContent =
        "パスワードが一致しません。";

    }

    return;

  }


  if (button) {

    button.disabled =
      true;

  }


  if (message) {

    message.textContent =
      "パスワードを変更しています…";

  }


  try {

    const {
      error
    } =
      await supabaseClient.auth.updateUser({
        password:
          password
      });


    if (error) {

      throw error;

    }


    console.log(
      "★ パスワード変更成功"
    );


    if (message) {

      message.textContent =
        "パスワードを変更しました。ログイン画面に戻ります…";

    }


    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          1500
        )
    );


    await supabaseClient.auth.signOut();


    const passwordUpdateView =
      document.getElementById(
        "passwordUpdateView"
      );

    const loginMainView =
      document.getElementById(
        "loginMainView"
      );


    if (passwordUpdateView) {

      passwordUpdateView.style.display =
        "none";

    }


    if (loginMainView) {

      loginMainView.style.display =
        "block";

    }


    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );


  } catch (error) {

    console.error(
      "★ パスワード変更エラー",
      error
    );


    if (message) {

      message.textContent =
        error?.message ||
        "パスワードの変更に失敗しました。";

    }

  } finally {

    if (button) {

      button.disabled =
        false;

    }

  }

}

/* ==================================================
   メールログイン
   ※通常ログイン画面では新規登録を行わない
================================================== */

async function loginWithEmail() {

  const emailInput =
    document.getElementById("loginEmail");

  const passwordInput =
    document.getElementById("loginPassword");

  const message =
    document.getElementById("loginMessage");

  const email =
    emailInput?.value.trim();

  const password =
    passwordInput?.value || "";

  if (!email || !password) {

    if (message) {
      message.textContent =
        "メールアドレスとパスワードを入力してください。";
    }

    return;
  }


  const button =
    document.getElementById("emailLoginButton");


  if (button) {
    button.disabled = true;
  }


  if (message) {
    message.textContent =
      "ログインしています…";
  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });


    if (error) {
      throw error;
    }


    if (!data?.session) {
      throw new Error(
        "ログインセッションを取得できませんでした。"
      );
    }


    console.log(
      "★ メールログイン成功"
    );


    /*
     * 招待リンクから来た場合は、
     * ログイン後に招待処理を行う
     */
    const inviteToken =
      sessionStorage.getItem(
        "pendingInviteToken"
      ) ||
      new URLSearchParams(
        window.location.search
      ).get("invite");


    if (inviteToken) {

      sessionStorage.setItem(
        "pendingInviteToken",
        inviteToken
      );

    }


    /*
     * ログイン成功後はinit()に処理を引き継ぐ
     */
    window.location.reload();


  } catch (error) {

    console.error(
      "メールログインエラー",
      error
    );


    if (message) {

      message.textContent =
        error?.message ||
        "ログインに失敗しました。";

    }

  } finally {

    if (button) {
      button.disabled = false;
    }

  }

}

async function sendPasswordResetEmail() {

  const emailInput =
    document.getElementById("resetEmail");

  const message =
    document.getElementById(
      "passwordResetMessage"
    );

  const button =
    document.getElementById(
      "sendPasswordResetButton"
    );

  const email =
    emailInput?.value.trim();

  if (!email) {

    if (message) {
      message.textContent =
        "メールアドレスを入力してください。";
    }

    return;
  }

  if (button) {
    button.disabled = true;
  }

  if (message) {
    message.textContent =
      "再設定メールを送信しています…";
  }

  try {

    const redirectTo =
      window.location.origin +
      window.location.pathname +
      "?password-reset=true";

    console.log(
      "★ 再設定メール送信開始"
    );

    console.log(
      "★ メールアドレス:",
      email
    );

    console.log(
      "★ redirectTo:",
      redirectTo
    );


    const {
      data,
      error
    } =
      await supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            redirectTo
        }
      );


    console.log(
      "★ resetPasswordForEmail 結果:",
      {
        data,
        error
      }
    );


    if (error) {
      throw error;
    }


    console.log(
      "★ パスワード再設定メール送信成功"
    );


    if (message) {

      message.textContent =
        "再設定用のメールを送信しました。\n" +
        "メールをご確認ください。";

    }


  } catch (error) {

    console.error(
      "★ パスワード再設定メール送信エラー",
      error
    );


    if (message) {

      message.textContent =
        error?.message ||
        "再設定メールの送信に失敗しました。";

    }

  } finally {

    if (button) {
      button.disabled = false;
    }

  }

}

/* ==================================================
   パスワード変更ボタン設定
================================================== */

function setupPasswordUpdate() {

  const button =
    document.getElementById(
      "updatePasswordButton"
    );


  if (!button) {

    console.log(
      "★ updatePasswordButton が見つかりません"
    );

    return;

  }


  /* --------------------------------------------------
     二重登録防止
  -------------------------------------------------- */

  button.onclick =
    updatePassword;


  console.log(
    "★ パスワード変更設定完了"
  );

}

/* ==================================================
   パスワード変更
================================================== */

async function updatePassword() {

  const passwordInput =
    document.getElementById(
      "newPassword"
    );

  const confirmInput =
    document.getElementById(
      "newPasswordConfirm"
    );

  const message =
    document.getElementById(
      "passwordUpdateMessage"
    );

  const button =
    document.getElementById(
      "updatePasswordButton"
    );

  const password =
    passwordInput?.value || "";

  const confirmPassword =
    confirmInput?.value || "";


  /* --------------------------------------------------
     入力チェック
  -------------------------------------------------- */

  if (!password) {

    if (message) {
      message.textContent =
        "新しいパスワードを入力してください。";
    }

    return;

  }


  if (password.length < 6) {

    if (message) {
      message.textContent =
        "パスワードは6文字以上で設定してください。";
    }

    return;

  }


  if (
    password !==
    confirmPassword
  ) {

    if (message) {
      message.textContent =
        "パスワードが一致しません。";
    }

    return;

  }


  /* --------------------------------------------------
     ボタン停止
  -------------------------------------------------- */

  if (button) {
    button.disabled = true;
  }

  if (message) {
    message.textContent =
      "パスワードを変更しています…";
  }


  try {

    console.log(
      "★ パスワード変更開始"
    );


    /* --------------------------------------------------
       Supabaseでパスワード変更
    -------------------------------------------------- */

    const {
      error
    } =
      await supabaseClient.auth.updateUser({
        password:
          password
      });


    console.log(
      "★ updateUser 結果:",
      error
    );


    if (error) {
      throw error;
    }


    console.log(
      "★ パスワード変更成功"
    );


    if (message) {

      message.textContent =
        "パスワードを変更しました。";

    }


    /* --------------------------------------------------
       少し表示してからログイン画面へ
    -------------------------------------------------- */

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          1200
        )
    );


    await supabaseClient.auth.signOut();


    /* --------------------------------------------------
       URLからパスワード再設定情報を削除
    -------------------------------------------------- */

    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );


    /* --------------------------------------------------
       パスワード変更画面を非表示
    -------------------------------------------------- */

    const passwordUpdateView =
      document.getElementById(
        "passwordUpdateView"
      );

    const loginMainView =
      document.getElementById(
        "loginMainView"
      );


    if (passwordUpdateView) {

      passwordUpdateView.style.display =
        "none";

    }


    if (loginMainView) {

      loginMainView.style.display =
        "block";

    }


    showLoginPage();


    console.log(
      "★ ログイン画面へ戻りました"
    );


  } catch (error) {

    console.error(
      "★ パスワード変更エラー",
      error
    );


    if (message) {

      message.textContent =
        error?.message ||
        "パスワードの変更に失敗しました。";

    }


  } finally {

    if (button) {

      button.disabled =
        false;

    }

  }

}

function setupPasswordUpdate() {

  const button =
    document.getElementById(
      "updatePasswordButton"
    );

  if (!button) {

    console.log(
      "★ updatePasswordButton が見つかりません"
    );

    return;

  }


  button.addEventListener(
    "click",
    updatePassword
  );


  console.log(
    "★ パスワード変更設定完了"
  );

}

function setupPasswordReset() {

  const forgotButton =
    document.getElementById(
      "forgotPasswordButton"
    );

  const resetView =
    document.getElementById(
      "passwordResetView"
    );

  const loginMainView =
    document.getElementById(
      "loginMainView"
    );

  const backButton =
    document.getElementById(
      "backToLoginFromReset"
    );

  const sendButton =
    document.getElementById(
      "sendPasswordResetButton"
    );


  if (forgotButton) {

    forgotButton.addEventListener(
      "click",
      function() {

        if (loginMainView) {

          loginMainView.style.display =
            "none";

        }

        if (resetView) {

          resetView.style.display =
            "block";

        }

        const loginEmail =
          document.getElementById(
            "loginEmail"
          );

        const resetEmail =
          document.getElementById(
            "resetEmail"
          );

        if (
          loginEmail &&
          resetEmail &&
          loginEmail.value.trim()
        ) {

          resetEmail.value =
            loginEmail.value.trim();

        }

      }
    );

  }


  if (backButton) {

    backButton.addEventListener(
      "click",
      function() {

        if (resetView) {

          resetView.style.display =
            "none";

        }

        if (loginMainView) {

          loginMainView.style.display =
            "block";

        }

      }
    );

  }


  if (sendButton) {

    sendButton.addEventListener(
      "click",
      sendPasswordResetEmail
    );

  }


  console.log(
    "★ パスワード初期化設定完了"
  );

}

function setupEmailLogin() {

  const button =
    document.getElementById(
      "emailLoginButton"
    );


  if (!button) {

    console.log(
      "★ emailLoginButton が見つかりません"
    );

    return;

  }


  button.addEventListener(
    "click",
    loginWithEmail
  );


  console.log(
    "★ メールログイン設定完了"
  );

}

async function registerWithEmail() {

  const emailInput =
    document.getElementById(
      "registerEmailInput"
    );

  const passwordInput =
    document.getElementById(
      "registerPasswordInput"
    );

  const message =
    document.getElementById(
      "registerMessage"
    );

  const button =
    document.getElementById(
      "registerEmailButton"
    );


  const email =
    emailInput?.value.trim();


  const password =
    passwordInput?.value;


  /*
   * ==================================================
   * 招待トークンを確認
   *
   * メールアドレスの新規登録は
   * 招待リンクから来た場合のみ許可する
   * ==================================================
   */

  const urlParams =
    new URLSearchParams(
      window.location.search
    );


  const inviteToken =
    urlParams.get("invite");


  if (!inviteToken) {

    if (message) {

      message.textContent =
        "新規登録は招待リンクからのみ行えます。";

    }

    return;

  }


  /*
   * ==================================================
   * 入力チェック
   * ==================================================
   */

  if (!email || !password) {

    if (message) {

      message.textContent =
        "メールアドレスとパスワードを入力してください。";

    }

    return;

  }


  if (password.length < 6) {

    if (message) {

      message.textContent =
        "パスワードは6文字以上で入力してください。";

    }

    return;

  }


  /*
   * ==================================================
   * 招待トークンを保存
   *
   * 確認メール後にログインした場合でも
   * 招待処理を続けられるようにする
   * ==================================================
   */

  sessionStorage.setItem(
    "pendingInviteToken",
    inviteToken
  );


  if (button) {

    button.disabled =
      true;

  }


  if (message) {

    message.textContent =
      "登録しています…";

  }


  try {

    const { data, error } =
      await supabaseClient.auth.signUp({
        email,
        password
      });


    if (error) {

      throw error;

    }


    /*
     * ==================================================
     * 確認メールが必要な場合
     * ==================================================
     */

    if (
      data.user &&
      !data.session
    ) {

      if (message) {

        message.textContent =
          "確認メールを送信しました。メールを確認してログインしてください。";

      }

      return;

    }


    /*
     * ==================================================
     * そのままログインできた場合
     * ==================================================
     */

    if (data.session) {

      sessionStorage.removeItem(
        "forceLoginScreen"
      );


      console.log(
        "メール登録成功"
      );


      /*
       * init()を再実行して、
       * 招待処理を含む通常の初期化を行う
       */

      window.location.reload();

    }


  } catch (error) {

    console.error(
      "メール登録エラー",
      error
    );


    if (message) {

      message.textContent =
        error.message ||
        "メール登録に失敗しました。";

    }

  } finally {

    if (button) {

      button.disabled =
        false;

    }

  }

}

/* ==================================================
   招待リンクからのメール新規登録
   ※招待リンクがない場合は絶対に登録しない
================================================== */

async function registerWithInviteEmail() {

  const emailInput =
    document.getElementById("inviteEmail");

  const passwordInput =
    document.getElementById("invitePassword");

  const confirmInput =
    document.getElementById("invitePasswordConfirm");

  const message =
    document.getElementById(
      "inviteRegisterMessage"
    );

  const button =
    document.getElementById(
      "inviteEmailButton"
    );


  const email =
    emailInput?.value.trim();

  const password =
    passwordInput?.value || "";

  const confirmPassword =
    confirmInput?.value || "";


  /*
   * URLの招待トークンを取得
   */
  const urlParams =
    new URLSearchParams(
      window.location.search
    );

  const urlInviteToken =
    urlParams.get("invite");


  /*
   * URLにない場合は、
   * セッションに保持している招待トークンを確認
   */
  const inviteToken =
    urlInviteToken ||
    sessionStorage.getItem(
      "pendingInviteToken"
    ) ||
    sessionStorage.getItem(
      "shiftInviteToken"
    );


  /*
   * ==================================================
   * 最重要
   *
   * 招待リンクがない場合は
   * auth.signUp()を絶対に実行しない
   * ==================================================
   */

  if (!inviteToken) {

    if (message) {

      message.textContent =
        "新規登録は招待リンクからのみ行えます。";

    }

    return;
  }


  if (!email) {

    if (message) {
      message.textContent =
        "メールアドレスを入力してください。";
    }

    return;
  }


  if (!password) {

    if (message) {
      message.textContent =
        "パスワードを入力してください。";
    }

    return;
  }


  if (password.length < 6) {

    if (message) {
      message.textContent =
        "パスワードは6文字以上で設定してください。";
    }

    return;
  }


  if (password !== confirmPassword) {

    if (message) {
      message.textContent =
        "パスワードが一致しません。";
    }

    return;
  }


  /*
   * 招待トークンを保存
   */
  sessionStorage.setItem(
    "pendingInviteToken",
    inviteToken
  );


  if (button) {
    button.disabled = true;
  }


  if (message) {
    message.textContent =
      "登録しています…";
  }


  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.signUp({

        email,

        password,

        options: {

          emailRedirectTo:
            window.location.origin +
            window.location.pathname +
            "?invite=" +
            encodeURIComponent(
              inviteToken
            )

        }

      });


    if (error) {
      throw error;
    }


    console.log(
      "★ 招待メール登録成功",
      data
    );


    /*
     * メール確認が必要な場合
     */
    if (
      data.user &&
      !data.session
    ) {

      if (message) {

        message.textContent =
          "確認メールを送信しました。メールを確認してから、メール内のリンクを開いてください。";

      }

      return;
    }


    /*
     * その場でログインできた場合
     */
    if (data.session) {

      sessionStorage.removeItem(
        "forceLoginScreen"
      );


      console.log(
        "★ 招待メール登録後のセッション取得成功"
      );


      /*
       * init()で招待処理を続行
       */
      window.location.reload();

    }


  } catch (error) {

    console.error(
      "招待メール登録エラー",
      error
    );


    if (message) {

      message.textContent =
        error?.message ||
        "メール登録に失敗しました。";

    }

  } finally {

    if (button) {
      button.disabled = false;
    }

  }

}

/* ==================================================
   招待トークン取得
================================================== */

function getPendingInviteToken() {

  /* --------------------------------------------------
     ① 現在のURL
     招待リンクから来た場合だけ取得
  -------------------------------------------------- */

  try {

    const url =
      new URL(
        window.location.href
      );

    const token =
      url.searchParams.get(
        "invite"
      );

    if (token) {

      console.log(
        "★ URLから招待トークン取得"
      );

      /*
       * 招待リンクから来たことを記録
       */
      sessionStorage.setItem(
        "pendingInviteToken",
        token
      );

      localStorage.setItem(
        "pendingInviteToken",
        token
      );

      return token;

    }

  } catch (error) {

    console.warn(
      "★ URLから招待トークン取得失敗",
      error
    );

  }


  /* --------------------------------------------------
     ② sessionStorage
     招待処理の途中だけ使用
  -------------------------------------------------- */

  const sessionToken =
    sessionStorage.getItem(
      "pendingInviteToken"
    );

  if (sessionToken) {

    console.log(
      "★ sessionStorageから招待トークン取得"
    );

    return sessionToken;

  }


  /* --------------------------------------------------
     ③ localStorage
     ここでは取得しない
     
     普通のログイン時に古い招待トークンを
     誤って使用するのを防ぐ。
  -------------------------------------------------- */

  return null;

}


/* ==================================================
   Googleログイン設定
================================================== */

async function loginWithGoogle() {

  const button =
    document.getElementById(
      "googleLoginButton"
    );


  try {

    const client =
      window.shiftSupabaseClient ||
      supabaseClient;


    if (!client) {

      throw new Error(
        "Supabaseが初期化されていません"
      );

    }


    if (button) {

      button.disabled =
        true;

    }


    /* --------------------------------------------------
       OAuthログイン中フラグ
    -------------------------------------------------- */

    sessionStorage.setItem(
      "oauthLoginInProgress",
      "true"
    );


    /* --------------------------------------------------
       招待トークンを取得
    -------------------------------------------------- */

    const urlParams =
      new URLSearchParams(
        window.location.search
      );


    const inviteToken =
      urlParams.get("invite");


    /*
     * 招待リンクから来た場合だけ
     * 招待トークンを保存する。
     *
     * 通常のGoogleログインでは
     * 招待トークンがなくても正常に進む。
     */

    if (inviteToken) {

      sessionStorage.setItem(
        "pendingInviteToken",
        inviteToken
      );

    }


    /* --------------------------------------------------
       ★ 古いSupabaseセッションを終了
    -------------------------------------------------- */

    console.log(
      "★ Googleログイン前の既存セッションを確認"
    );


    const sessionResult =
      await client.auth.getSession();


    if (sessionResult.error) {

      console.warn(
        "★ 既存セッション取得エラー",
        sessionResult.error
      );

    }


    const oldSession =
      sessionResult?.data?.session;


    if (oldSession) {

      console.log(
        "★ 古いSupabaseセッションを検出しました。ログアウトします。",
        {
          userId:
            oldSession.user?.id,
          email:
            oldSession.user?.email
        }
      );


      const signOutResult =
        await client.auth.signOut();


      if (signOutResult.error) {

        console.error(
          "★ 古いSupabaseセッションの終了に失敗",
          signOutResult.error
        );

        throw signOutResult.error;

      }


      console.log(
        "★ 古いSupabaseセッションを終了しました"
      );

    } else {

      console.log(
        "★ 古いSupabaseセッションはありません"
      );

    }


    /* --------------------------------------------------
       OAuth戻り先
    -------------------------------------------------- */

    const redirectBase =
      "https://mya24950-dotcom.github.io/kinmu-app/";


    let redirectTo =
      redirectBase;


    /*
      招待URLから来た場合は、
      OAuth後の戻り先にも招待トークンを付ける。

      sessionStorage / localStorage が
      何らかの理由で保持されなかった場合でも、
      URLから復元できるようにする。
    */

    if (inviteToken) {

      redirectTo +=
        "?invite=" +
        encodeURIComponent(
          inviteToken
        );

    }


    console.log(
      "★ Google OAuth開始",
      {
        redirectTo,
        hasInvite:
          !!inviteToken
      }
    );


    /* --------------------------------------------------
       Google OAuth
    -------------------------------------------------- */

    const result =
      await client.auth.signInWithOAuth({

        provider:
          "google",

        options: {

          redirectTo,

          queryParams: {

            prompt:
              "select_account"

          }

        }

      });


    if (result.error) {

      throw result.error;

    }

  } catch (error) {

    console.error(
      "Googleログインエラー",
      error
    );


    sessionStorage.removeItem(
      "oauthLoginInProgress"
    );


    if (button) {

      button.disabled =
        false;

    }


    hideInitialLoading();


    alert(
      "Googleログインに失敗しました。\n\n" +
      (
        error?.message ||
        error
      )
    );

  }

}

async function startOrganizationGoogleRegistration() {

  const orgInput =
    document.getElementById("organizationNameInput");

  const staffInput =
    document.getElementById("organizationStaffNameInput");

  const organizationName =
    orgInput?.value.trim() || "";

  const staffName =
    staffInput?.value.trim() || "";


  /* --------------------------------
     入力チェック
  -------------------------------- */

  if (!organizationName) {
    alert("職場名を入力してください。");
    orgInput?.focus();
    return;
  }

  if (!staffName) {
    alert("登録者名を入力してください。");
    staffInput?.focus();
    return;
  }


  /* --------------------------------
     Google認証後に使用する情報を保存
  -------------------------------- */

  sessionStorage.setItem(
    "pendingOrganizationName",
    organizationName
  );

  sessionStorage.setItem(
    "pendingStaffName",
    staffName
  );


  /* --------------------------------
     OAuth開始中フラグ
  -------------------------------- */

  sessionStorage.setItem(
    "oauthLoginInProgress",
    "true"
  );


  const client =
    window.shiftSupabaseClient || supabaseClient;

  if (!client) {

    sessionStorage.removeItem(
      "oauthLoginInProgress"
    );

    alert(
      "認証システムの準備ができていません。"
    );

    return;
  }


  try {

    const redirectTo =
      `${window.location.origin}${window.location.pathname}`;


    const {
      error
    } = await client.auth.signInWithOAuth({

      provider: "google",

      options: {

        redirectTo: redirectTo,

        queryParams: {
          prompt: "select_account"
        }

      }

    });


    if (error) {
      throw error;
    }


  } catch (error) {

    console.error(
      "★ Google新規職場登録エラー:",
      error
    );

    sessionStorage.removeItem(
      "oauthLoginInProgress"
    );

    alert(
      "Google登録を開始できませんでした。\n\n" +
      (error?.message || "不明なエラー")
    );

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

  const orgInput =
    document.getElementById("organizationNameInput");

  const staffInput =
    document.getElementById("organizationStaffNameInput");

  const emailInput =
    document.getElementById("organizationEmail");

  const passwordInput =
    document.getElementById("organizationPassword");

  const passwordConfirmInput =
    document.getElementById("organizationPasswordConfirm");

  const organizationName =
    orgInput?.value.trim() || "";

  const staffName =
    staffInput?.value.trim() || "";

  const email =
    emailInput?.value.trim() || "";

  const password =
    passwordInput?.value || "";

  const passwordConfirm =
    passwordConfirmInput?.value || "";


  /* --------------------------------
     入力チェック
  -------------------------------- */

  if (!organizationName) {
    alert("職場名を入力してください。");
    orgInput?.focus();
    return;
  }

  if (!staffName) {
    alert("登録者名を入力してください。");
    staffInput?.focus();
    return;
  }

  if (!email) {
    alert("メールアドレスを入力してください。");
    emailInput?.focus();
    return;
  }

  if (!password) {
    alert("パスワードを入力してください。");
    passwordInput?.focus();
    return;
  }

  if (password.length < 6) {
    alert("パスワードは6文字以上で入力してください。");
    passwordInput?.focus();
    return;
  }

  if (!passwordConfirm) {
    alert("確認用パスワードを入力してください。");
    passwordConfirmInput?.focus();
    return;
  }

  if (password !== passwordConfirm) {
    alert("パスワードと確認用パスワードが一致していません。");
    passwordConfirmInput?.focus();
    return;
  }


  /* --------------------------------
     Supabaseクライアント
  -------------------------------- */

  const client =
    window.shiftSupabaseClient || supabaseClient;

  if (!client) {
    alert("認証システムの準備ができていません。");
    return;
  }


  /* --------------------------------
     職場登録情報を一時保存
     
     メール確認後にこの情報を使って
     職場を作成する
  -------------------------------- */

  sessionStorage.setItem(
    "pendingOrganizationName",
    organizationName
  );

  sessionStorage.setItem(
    "pendingStaffName",
    staffName
  );


  /* --------------------------------
     ボタンを一時無効化
  -------------------------------- */

  const createButton =
    document.getElementById("createOrganizationButton");

  if (createButton) {
    createButton.disabled = true;
    createButton.textContent = "登録しています…";
  }


  try {

    /* --------------------------------
       メールアドレスでSupabase新規登録
    -------------------------------- */

    const redirectTo =
      `${window.location.origin}${window.location.pathname}`;

    const {
      data,
      error
    } = await client.auth.signUp({

      email: email,

      password: password,

      options: {
        emailRedirectTo: redirectTo
      }

    });


    if (error) {
      throw error;
    }


    /* --------------------------------
       すぐにログイン状態になった場合
       
       Supabaseでメール確認を不要に
       している場合はこちら
    -------------------------------- */

    if (data?.session) {

      window.location.reload();

      return;
    }


    /* --------------------------------
       メール確認が必要な場合
    -------------------------------- */

    if (data?.user) {

      const newOrgForm =
        document.getElementById(
          "newOrganizationForm"
        );

      const loginMainView =
        document.getElementById(
          "loginMainView"
        );

      const loginMessage =
        document.getElementById(
          "loginMessage"
        );


      if (newOrgForm) {
        newOrgForm.style.display = "none";
      }

      if (loginMainView) {
        loginMainView.style.display = "block";
      }

      if (loginMessage) {

        loginMessage.textContent =
          "確認メールを送信しました。メール内のリンクを開いて登録を完了してください。";

        loginMessage.style.display = "block";
      }


      alert(
        "確認メールを送信しました。\n\nメール内のリンクを開くと、職場の登録が完了します。"
      );

      return;
    }


    throw new Error(
      "アカウント登録を確認できませんでした。"
    );


  } catch (error) {

    console.error(
      "★ 新規職場登録エラー:",
      error
    );

    alert(
      "新規登録に失敗しました。\n\n" +
      (error?.message || "不明なエラー")
    );

  } finally {

    if (createButton) {

      createButton.disabled = false;

      createButton.textContent =
        "職場を登録する";

    }

  }

}

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

  const cancelButton =
    document.getElementById(
      "cancelOrganizationButton"
    );

  const createButton =
    document.getElementById(
      "createOrganizationButton"
    );

  const googleButton =
    document.getElementById(
      "organizationGoogleButton"
    );

  const orgInput =
    document.getElementById(
      "organizationNameInput"
    );

  const staffInput =
    document.getElementById(
      "organizationStaffNameInput"
    );

  const emailInput =
    document.getElementById(
      "organizationEmail"
    );

  const passwordInput =
    document.getElementById(
      "organizationPassword"
    );

  const passwordConfirmInput =
    document.getElementById(
      "organizationPasswordConfirm"
    );


  /* --------------------------------
     新規職場登録画面を開く
  -------------------------------- */

  if (newOrganizationButton) {

    newOrganizationButton.onclick =
      function(event) {

        event.preventDefault();

        if (loginMainView) {
          loginMainView.style.display =
            "none";
        }

        if (newOrganizationForm) {
          newOrganizationForm.style.display =
            "block";
        }

        if (orgInput) {
          orgInput.value = "";
        }

        if (staffInput) {
          staffInput.value = "";
        }

        if (emailInput) {
          emailInput.value = "";
        }

        if (passwordInput) {
          passwordInput.value = "";
        }

        if (passwordConfirmInput) {
          passwordConfirmInput.value = "";
        }

      };

  }


  /* --------------------------------
     戻る
  -------------------------------- */

  if (cancelButton) {

    cancelButton.onclick =
      function() {

        if (newOrganizationForm) {
          newOrganizationForm.style.display =
            "none";
        }

        if (loginMainView) {
          loginMainView.style.display =
            "block";
        }

        if (orgInput) {
          orgInput.value = "";
        }

        if (staffInput) {
          staffInput.value = "";
        }

        if (emailInput) {
          emailInput.value = "";
        }

        if (passwordInput) {
          passwordInput.value = "";
        }

        if (passwordConfirmInput) {
          passwordConfirmInput.value = "";
        }

      };

  }


  /* --------------------------------
     メールアドレスで職場を登録
  -------------------------------- */

  if (createButton) {

    createButton.onclick =
      async function() {

        await createNewOrganization();

      };

  }


  /* --------------------------------
     Googleで職場を登録
  -------------------------------- */

  if (googleButton) {

    googleButton.onclick =
      async function() {

        await startOrganizationGoogleRegistration();

      };

  }


  /*
     Apple / Azure は今回は処理を変更しない
     
     今後ここに追加する
  */

}

/* ==================================================
   Googleログイン後の招待処理
================================================== */

async function handleInviteAfterLogin(
  passedInviteToken = null
) {

  console.log(
    "★ 招待処理開始"
  );


  /* --------------------------------------------------
     招待トークン取得
    優先順位：
    1. 引数
    2. URL
    3. sessionStorage
    4. localStorage
  -------------------------------------------------- */

  let inviteToken =
    passedInviteToken ||
    getPendingInviteToken();


  if (!inviteToken) {

    console.log(
      "★ 招待トークンなし"
    );

    return false;

  }


  console.log(
    "★ 招待トークン確認済み"
  );


  /* --------------------------------------------------
     念のため保存
  -------------------------------------------------- */

  sessionStorage.setItem(
    "pendingInviteToken",
    inviteToken
  );


  localStorage.setItem(
    "pendingInviteToken",
    inviteToken
  );


  /* --------------------------------------------------
     Supabase確認
  -------------------------------------------------- */

  if (!supabaseClient) {

    throw new Error(
      "Supabaseが初期化されていません"
    );

  }


  /* --------------------------------------------------
     現在のログインユーザー確認
  -------------------------------------------------- */

  const {
    data: userData,
    error: userError
  } =
    await supabaseClient.auth.getUser();


  if (userError) {

    throw userError;

  }


  const user =
    userData?.user;


  if (!user) {

    throw new Error(
      "ログインユーザーを取得できませんでした"
    );

  }


  console.log(
    "★ 招待処理対象ユーザー",
    user.id
  );


  /* --------------------------------------------------
     招待RPC実行
  -------------------------------------------------- */

  const {
    data,
    error
  } =
    await supabaseClient.rpc(
      "accept_staff_invite",
      {
        target_invite_token:
          inviteToken
      }
    );


  console.log(
    "★ accept_staff_invite 結果",
    {
      data,
      error
    }
  );


  if (error) {

    console.error(
      "★ 招待登録RPCエラー",
      error
    );

    throw error;

  }


  /* --------------------------------------------------
     RPC結果確認
  -------------------------------------------------- */

  if (
    !data ||
    !data.length
  ) {

    throw new Error(
      "招待登録結果を取得できませんでした"
    );

  }


  const result =
    data[0];


  console.log(
    "★ 招待登録成功",
    result
  );


  /* --------------------------------------------------
     招待トークン削除
  -------------------------------------------------- */

  sessionStorage.removeItem(
  "pendingInviteToken"
);

localStorage.removeItem(
  "pendingInviteToken"
);

sessionStorage.removeItem(
  "shiftInviteToken"
);


  /* --------------------------------------------------
     URLから invite を削除
  -------------------------------------------------- */

  try {

    const cleanUrl =
      new URL(
        window.location.href
      );


    cleanUrl.searchParams.delete(
      "invite"
    );


    window.history.replaceState(
      {},
      document.title,
      cleanUrl.pathname +
        cleanUrl.search +
        cleanUrl.hash
    );

  } catch (error) {

    console.warn(
      "★ 招待URL整理失敗",
      error
    );

  }


  /* --------------------------------------------------
     登録完了
  -------------------------------------------------- */

  alert(
    `${result.staff_name}さんとして登録しました。`
  );


  return true;

}

/* ==================================================
   現在の職場を取得
================================================== */

async function getCurrentOrganization(
  userId
) {
  console.log(
    "★ getCurrentOrganization 開始",
    userId
  );
  if (!supabaseClient) {
    throw new Error(
      "Supabaseが初期化されていません"
    );
  }
  if (!userId) {
    console.error(
      "★ userIdがありません"
    );
    return null;
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
      "★ 職場情報取得エラー",
      error
    );
    throw error;
  }
  console.log(
    "★ organization_members取得結果",
    data
  );
  if (
    !data ||
    data.length === 0
  ) {
    console.log(
      "★ このユーザーには職場所属がありません"
    );
    return null;
  }
  const member =
    data[0];
  if (
    !member.organizations
  ) {
    console.error(
      "★ organization情報が取得できません",
      member
    );
    return null;
  }
  const organization = {
    id:
      member.organizations.id,
    name:
      member.organizations.name,
    created_at:
      member.organizations.created_at,
    role:
      member.role
  };
  console.log(
    "★ 現在の職場",
    organization
  );
  return organization;
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

/* =========================================================
   Supabase Realtime
========================================================= */

let realtimeReconnectTimer = null;


/* ---------------------------------------------------------
   Realtime接続
--------------------------------------------------------- */

function setupRealtime() {

  if (!supabaseClient) {

    return;

  }


  /* -------------------------------------------------------
     すでに再接続予約がある場合は重複させない
  ------------------------------------------------------- */

  if (realtimeReconnectTimer) {

    clearTimeout(
      realtimeReconnectTimer
    );

    realtimeReconnectTimer =
      null;

  }


  /* -------------------------------------------------------
     旧チャンネルを削除
     
     重要：
     realtimeChannel を先に null にする。
     removeChannel() によって CLOSED が発生しても、
     それを新しい接続のエラーとして扱わない。
  ------------------------------------------------------- */

  if (
    realtimeChannel
  ) {

    const oldChannel =
      realtimeChannel;

    realtimeChannel =
      null;

    try {

      supabaseClient.removeChannel(
        oldChannel
      );

    } catch (error) {

      console.warn(
        "Realtime旧チャンネル削除エラー",
        error
      );

    }

  }


  /* -------------------------------------------------------
     新しいチャンネルを作成
  ------------------------------------------------------- */

  const channel =
    supabaseClient
      .channel(
        "kinmu-app-realtime"
      );


  /* -------------------------------------------------------
     職員
  ------------------------------------------------------- */

  channel.on(
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
  );


  /* -------------------------------------------------------
     勤務
  ------------------------------------------------------- */

  channel.on(
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
  );


  /* -------------------------------------------------------
     勤務形態
  ------------------------------------------------------- */

  channel.on(
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
  );


  /* -------------------------------------------------------
     休暇
  ------------------------------------------------------- */

  channel.on(
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
  );


  /* -------------------------------------------------------
     休業
  ------------------------------------------------------- */

  channel.on(
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
  );


  /* -------------------------------------------------------
     明け時間
  ------------------------------------------------------- */

  channel.on(
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
  );


  /* -------------------------------------------------------
     現在のチャンネルを登録
  ------------------------------------------------------- */

  realtimeChannel =
    channel;


  /* -------------------------------------------------------
     Subscribe
  ------------------------------------------------------- */

  channel.subscribe(
    status => {

      console.log(
        "Supabase Realtime STATUS:",
        status
      );


      /* -----------------------------------------------
         接続成功
      ------------------------------------------------ */

      if (
        status ===
        "SUBSCRIBED"
      ) {

        console.log(
          "★ Realtime接続成功"
        );

        return;

      }


      /* -----------------------------------------------
         接続エラー
         
         現在のチャンネル自身から発生した
         エラーだけを処理する。
         
         旧チャンネルを削除した際の CLOSED は
         再接続しない。
      ------------------------------------------------ */

      if (
        status ===
          "CHANNEL_ERROR" ||
        status ===
          "TIMED_OUT" ||
        status ===
          "CLOSED"
      ) {

        if (
          realtimeChannel !==
          channel
        ) {

          console.log(
            "★ 旧Realtimeチャンネルの終了を確認"
          );

          return;

        }


        console.warn(
          "Realtime接続エラー。再接続を予約します。"
        );


        /* ---------------------------------------------
           すでに再接続予約がある場合は何もしない
        --------------------------------------------- */

        if (
          realtimeReconnectTimer
        ) {

          return;

        }


        realtimeReconnectTimer =
          setTimeout(
            () => {

              realtimeReconnectTimer =
                null;


              /* ---------------------------------------
                 ページが表示中の場合のみ再接続
              --------------------------------------- */

              if (
                document.visibilityState !==
                "visible"
              ) {

                return;

              }


              /* ---------------------------------------
                 別の接続がすでに存在する場合は不要
              --------------------------------------- */

              if (
                realtimeChannel !==
                channel
              ) {

                return;

              }


              setupRealtime();

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

  if (cloudOperationBusy) {

    realtimeReloadPending = true;

    return;

  }


  if (realtimeUpdating) {

    realtimeReloadPending = true;

    return;

  }


  try {

    realtimeUpdating = true;


    await loadAllFromSupabase();

    await renderAll();


  } catch (error) {

    console.error(
      "Supabase再読み込みエラー",
      error
    );


  } finally {

    realtimeUpdating = false;

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


function showPage(page) {

  console.log("showPage:", page);

  /* =====================================================
     ① ログイン画面を完全に隠す
     ===================================================== */

  const loginPage =
    document.getElementById("loginPage");

  if (loginPage) {

    loginPage.style.setProperty(
      "display",
      "none",
      "important"
    );

    loginPage.style.setProperty(
      "visibility",
      "hidden",
      "important"
    );

    loginPage.style.setProperty(
      "opacity",
      "0",
      "important"
    );

    loginPage.style.setProperty(
      "pointer-events",
      "none",
      "important"
    );
  }


  /* =====================================================
     ② アプリ本体を表示
     ===================================================== */

  const app =
    document.getElementById("app");

  if (app) {

    app.style.setProperty(
      "display",
      "block",
      "important"
    );

    app.style.setProperty(
      "visibility",
      "visible",
      "important"
    );

    app.style.setProperty(
      "opacity",
      "1",
      "important"
    );

    app.style.setProperty(
      "pointer-events",
      "auto",
      "important"
    );
  }


  /* =====================================================
     ③ すべてのページを一旦非表示
     ===================================================== */

  document
    .querySelectorAll(".page")
    .forEach(function(element) {

      element.style.display = "none";

    });


  /* =====================================================
     ④ 表示するページを取得
     ===================================================== */

  const targetPage =
    document.getElementById(page + "Page");


  if (!targetPage) {

    console.error(
      "ページが見つかりません:",
      page + "Page"
    );

    return;
  }


  /* =====================================================
     ⑤ 選択されたページを表示
     ===================================================== */

  targetPage.style.display = "block";


  /* =====================================================
     ⑥ ナビボタンのactiveをリセット
     ===================================================== */

  document
    .querySelectorAll(".nav-button")
    .forEach(function(button) {

      button.classList.remove("active");

    });


  /* =====================================================
     ⑦ 現在のページのボタンをactiveにする
     ===================================================== */

  const activeButton =
    document.querySelector(
      '.nav-button[data-page="' +
      page +
      '"]'
    );


  if (activeButton) {

    activeButton.classList.add("active");

  }


  /* =====================================================
     ⑧ ページごとの表示処理
     ===================================================== */

  if (page === "schedule") {

    if (typeof renderSchedule === "function") {
      renderSchedule();
    }

  }

  else if (page === "staff") {

    if (typeof renderStaffList === "function") {
      renderStaffList();
    }

  }

  else if (page === "leave") {

    if (typeof renderLeaveList === "function") {
      renderLeaveList();
    }

  }

  else if (page === "shift") {

    if (typeof renderShiftList === "function") {
      renderShiftList();
    }

  }

  else if (page === "holiday") {

    if (typeof renderHolidayList === "function") {
      renderHolidayList();
    }

  }


  /* =====================================================
     ⑨ シフトメニューを閉じる
     ===================================================== */

  if (typeof hideShiftMenu === "function") {

    hideShiftMenu();

  }


  /* =====================================================
     ⑩ ページ上部へ
     ===================================================== */

  window.scrollTo(0, 0);
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

     const issueExcelSyncTokenButton =
    document.getElementById(
      "issueExcelSyncTokenButton"
    );


  if (issueExcelSyncTokenButton) {

    issueExcelSyncTokenButton.addEventListener(
      "click",
      issueExcelSyncToken
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

async function issueExcelSyncToken() {

  /*
   * ==========================================
   * 管理者チェック
   * ==========================================
   */

  if (!currentOrganization) {

    alert(
      "現在の職場情報を取得できません。"
    );

    return;

  }


  if (
    currentOrganization.role !== "admin"
  ) {

    alert(
      "Excel連携コードを発行できるのは管理者だけです。"
    );

    return;

  }


  /*
   * ==========================================
   * Supabase確認
   * ==========================================
   */

  if (!supabaseClient) {

    alert(
      "Supabaseに接続されていません。"
    );

    return;

  }


  /*
   * ==========================================
   * 発行確認
   * ==========================================
   */

  const confirmed =
    confirm(
      "Excel連携コードを発行しますか？\n\n" +
      "新しいコードを発行すると、現在のコードは使用できなくなります。"
    );


  if (!confirmed) {

    return;

  }


  const button =
    document.getElementById(
      "issueExcelSyncTokenButton"
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      "発行中...";

  }


  try {

    /*
     * ==========================================
     * Supabase RPC
     * ==========================================
     */

    const result =
      await supabaseClient.rpc(
        "create_excel_sync_token",
        {
          p_organization_id:
            currentOrganization.id
        }
      );


    if (result.error) {

      throw result.error;

    }


    const token =
      result.data;


    if (!token) {

      throw new Error(
        "Excel連携コードを取得できませんでした。"
      );

    }


    /*
     * ==========================================
     * 画面に表示
     * ==========================================
     */

    const resultArea =
      document.getElementById(
        "excelSyncTokenResult"
      );


    const tokenValue =
      document.getElementById(
        "excelSyncTokenValue"
      );


    if (tokenValue) {

      tokenValue.textContent =
        token;

    }


    if (resultArea) {

      resultArea.style.display =
        "block";

    }


    alert(
      "Excel連携コードを発行しました。\n\n" +
      token +
      "\n\n" +
      "有効期限は24時間です。"
    );


  } catch (error) {

    console.error(
      "Excel連携コード発行エラー",
      error
    );


    alert(
      "Excel連携コードの発行に失敗しました。\n\n" +
      (
        error.message ||
        "不明なエラー"
      )
    );


  } finally {

    if (button) {

      button.disabled =
        false;

      button.textContent =
        "Excel連携コードを発行";

    }

  }

}


/* =========================================================
   ログイン画面のボタンをまとめて設定
========================================================= */

function setupAllLoginButtons() {

  console.log("★ ログインボタン設定開始");

  /* -----------------------------------------
     Google
  ----------------------------------------- */

  setupGoogleLogin();


  /* -----------------------------------------
     Apple
  ----------------------------------------- */

  setupAppleLogin();


  /* -----------------------------------------
     Azure
  ----------------------------------------- */

  if (typeof setupAzureLogin === "function") {
    setupAzureLogin();
  }


  /* -----------------------------------------
     Passkey
  ----------------------------------------- */

  setupPasskeyLogin();


  /* -----------------------------------------
     メールログイン
  ----------------------------------------- */

  setupEmailLogin();


  /* -----------------------------------------
     新規職場登録
  ----------------------------------------- */

  setupNewOrganizationButton();

  console.log("★ ログインボタン設定完了");
}

/* ==================================================
   全体描画
================================================== */

async function renderAll() {

  await renderSchedule();

  await renderStaffList();

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


/* =========================================================
   休暇一覧（勤務表の下）
   ========================================================= */

function renderLeaveLegend() {

  const table =
    document.getElementById(
      "scheduleTable"
    );

  if (!table) {
    return;
  }


  /* ---------------------------------------------------------
     休暇一覧のコンテナを取得・作成
     --------------------------------------------------------- */

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


    /* 基本レイアウト */

    legend.style.marginTop =
      "10px";

    legend.style.marginBottom =
      "10px";

    legend.style.padding =
      "10px 12px";

    legend.style.borderRadius =
      "10px";

    legend.style.boxSizing =
      "border-box";

    legend.style.display =
      "flex";

    legend.style.flexWrap =
      "wrap";

    legend.style.alignItems =
      "center";

    legend.style.gap =
      "8px 14px";


    /*
      色はCSS側で管理する。
      ダークモードのCSSが適用できるように
      インラインで白色を指定しない。
    */

    legend.classList.add(
      "leave-legend"
    );


    if (
      table.parentElement
    ) {

      table.parentElement.insertBefore(
        legend,
        table.nextSibling
      );

    }

  }


  /* ---------------------------------------------------------
     休暇データがない場合
     --------------------------------------------------------- */

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


  /* ---------------------------------------------------------
     表示
     --------------------------------------------------------- */

  legend.style.display =
    "flex";

  legend.style.flexWrap =
    "wrap";

  legend.style.alignItems =
    "center";

  legend.style.gap =
    "8px 14px";


  /* ---------------------------------------------------------
     タイトル
     「休暇設定」と同じカレンダー＋チェックアイコン
     --------------------------------------------------------- */

  let html =
    `
      <div
        class="leave-legend-title"
        style="
          width:100%;
          font-weight:700;
          font-size:14px;
          margin-bottom:2px;
          display:flex;
          align-items:center;
          gap:6px;
        "
      >

        <svg
          class="section-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style="
            width:20px;
            height:20px;
            flex-shrink:0;
          "
        >

          <rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />

          <line
            x1="7"
            y1="2.5"
            x2="7"
            y2="6"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />

          <line
            x1="17"
            y1="2.5"
            x2="17"
            y2="6"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          />

          <line
            x1="3"
            y1="9"
            x2="21"
            y2="9"
            stroke="currentColor"
            stroke-width="1.8"
          />

          <path
            d="M8 15l2.3 2.3L16.5 11"
            fill="none"
            stroke="currentColor"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

        </svg>


        <span>
          休暇一覧
        </span>

      </div>
    `;


  /* ---------------------------------------------------------
     休暇一覧
     --------------------------------------------------------- */

  appData.leaveTypes.forEach(
    leave => {

      const color =
        leave.color ||
        "#FFD54F";


      html +=
        `
          <div
            class="leave-legend-item"
            style="
              display:flex;
              align-items:center;
              gap:6px;
              min-height:28px;
            "
          >

            <!-- 休暇色 -->

            <span
              class="leave-legend-color"
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


            <!-- 休暇名 -->

            <span
              class="leave-legend-name"
              style="
                font-size:13px;
                line-height:1.3;
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


  /* ---------------------------------------------------------
     HTMLを反映
     --------------------------------------------------------- */

  legend.innerHTML =
    html;

}

/* ==================================================
   勤務表
================================================== */

async function renderSchedule() {

  // ログイン中の職員ID
  let currentStaffId = null;

  try {
    currentStaffId =
      await getCurrentStaffId();
  } catch (error) {
    console.error(
      "ログイン中の職員ID取得エラー",
      error
    );
  }
   
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


    const isCurrentUser =
  currentStaffId &&
  staff.id === currentStaffId;

html += `
  <tr
    class="staff-row ${
      isCurrentUser
        ? "current-user-staff-row"
        : ""
    }"
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
  "transparent";


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
  "transparent";


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


/* ==================================================
   左上「職員」セルのダークモード対応
================================================== */

if (
  document.body.classList.contains(
    "dark-mode"
  )
) {

  cloned.style.setProperty(
    "background-color",
    "#2c2c2e",
    "important"
  );

  cloned.style.setProperty(
    "color",
    "#ffffff",
    "important"
  );

}


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

async function bindScheduleCells() {

  /* ==================================================
     ログイン中の職員IDを取得
  ================================================== */

  let currentStaffId = null;

  try {

    currentStaffId =
      await getCurrentStaffId();

  } catch (error) {

    console.error(
      "ログイン中の職員ID取得エラー",
      error
    );

  }


  /* ==================================================
     管理者か職員か
  ================================================== */

  const isAdmin =
    currentOrganization &&
    currentOrganization.role === "admin";


  /* ==================================================
     職員の場合、自分の職員名を取得
  ================================================== */

  let currentStaffName = null;

  if (!isAdmin && currentStaffId) {

    const currentStaff =
      appData.staff.find(
        staff =>
          staff.id === currentStaffId
      );

    if (currentStaff) {

      currentStaffName =
        getStaffName(
          currentStaff
        );

    }

  }


  /* ==================================================
     セルクリック
  ================================================== */

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


            /* ==========================================
               職員の場合
               自分以外のセルは選択不可
            ========================================== */

            if (!isAdmin) {

              const cellStaffName =
                cell.dataset.staff;

              if (
                !currentStaffName ||
                cellStaffName !== currentStaffName
              ) {

                return;

              }

            }


            /* ==========================================
               前に選択していたセルの枠を消す
            ========================================== */

            if (selectedCell) {

              selectedCell.classList.remove(
                "selected-cell"
              );

            }


            /* ==========================================
               今タップしたセルを選択
            ========================================== */

            selectedCell =
              cell;

            selectedCell.classList.add(
              "selected-cell"
            );


            /* ==========================================
               管理者
               → 勤務変更モード

               職員
               → 休暇モード
            ========================================== */

            if (isAdmin) {

              shiftMenuMode =
                "shift";

            } else {

              shiftMenuMode =
                "leave";

            }


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
   アプリで変更した勤務セルを記録
================================================== */

async function recordAppModifiedShift(
  staffName,
  dateKey
) {

  if (
    !supabaseClient ||
    !currentOrganization ||
    !currentOrganization.id
  ) {

    throw new Error(
      "職場情報を取得できませんでした。"
    );

  }


  const name =
    getStaffName(
      staffName
    );


  const result =
    await supabaseClient
      .from("app_modified_shifts")
      .upsert(
        {
          organization_id:
            currentOrganization.id,

          staff_name:
            name,

          work_date:
            dateKey,

          modified_at:
            new Date().toISOString()

        },
        {
          onConflict:
            "organization_id,staff_name,work_date"
        }
      );


  if (
    result.error
  ) {

    console.error(
      "アプリ変更記録エラー",
      result.error
    );

    throw result.error;

  }


  console.log(
    "★ アプリ変更記録",
    {
      staffName:
        name,

      dateKey:
        dateKey,

      modifiedAt:
        new Date().toISOString()
    }
  );

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

           await recordAppModifiedShift(
  name,
  dateKey
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

await recordAppModifiedShift(
  name,
  dateKey
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

       await recordAppModifiedShift(
  name,
  dateKey
);

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

       await recordAppModifiedShift(
  name,
  dateKey
);

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

  /* --------------------------------------------------
     入力チェック
  -------------------------------------------------- */

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

  /* --------------------------------------------------
     重複チェック
  -------------------------------------------------- */

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

  if (
    !supabaseClient
  ) {

    alert(
      "Supabaseに接続されていません。"
    );

    return;
  }

  if (
    !currentOrganization ||
    !currentOrganization.id
  ) {

    alert(
      "職場情報を取得できませんでした。"
    );

    return;
  }

  cloudOperationBusy =
    true;

  try {

    /* ==================================================
       職員名の編集
    ================================================== */

    if (
      editingStaffIndex >= 0
    ) {

      const oldStaff =
        appData.staff[
          editingStaffIndex
        ];

      if (
        !oldStaff ||
        !oldStaff.id
      ) {

        throw new Error(
          "編集対象の職員情報を取得できませんでした。"
        );

      }

      const oldName =
        getStaffName(
          oldStaff
        );

      console.log(
        "★ 職員名編集開始",
        {
          id:
            oldStaff.id,

          oldName:
            oldName,

          newName:
            name
        }
      );

      /*
       * PATCHではなくRPCで
       * staff.name と work_shifts.staff_name を
       * 同時に変更する
       */
      const result =
        await supabaseClient.rpc(
          "update_staff_name",
          {
            p_staff_id:
              oldStaff.id,

            p_old_name:
              oldName,

            p_new_name:
              name
          }
        );

      console.log(
        "★ 職員名編集RPC結果",
        result
      );

      if (
        result.error
      ) {

        console.error(
          "★ 職員名編集RPC失敗",
          result.error
        );

        throw result.error;
      }

      console.log(
        "★ 職員名編集成功"
      );

      editingStaffIndex =
        -1;

    }

    /* ==================================================
       新規職員追加
    ================================================== */

    else {

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

      console.log(
        "★ 職員追加開始",
        {
          name:
            name,

          sort_order:
            maxOrder + 1,

          organization_id:
            currentOrganization.id
        }
      );

      /*
       * 職員を追加
       */
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

      console.log(
        "★ 職員追加結果",
        result
      );

      if (
        result.error
      ) {

        console.error(
          "★ 職員追加失敗",
          result.error
        );

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

      console.log(
        "★ 新規職員ID取得",
        newStaff.id
      );

      
      console.log(
        "★ 職員追加成功"
      );

    }

    /* ==================================================
       入力欄・ボタンを初期状態へ戻す
    ================================================== */

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

    /* ==================================================
       Supabaseから最新データを再取得
    ================================================== */

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
/* =========================================================
   職員の並び順をSupabaseへ保存
========================================================= */

/* =========================================================
   職員の並び順をSupabaseへ保存
   ※ PATCHを使わずRPCで保存
========================================================= */

async function saveStaffOrder() {

  console.log(
    "★★★ 職員並び順RPC保存開始 ★★★"
  );

  try {

    for (
      let i = 0;
      i < appData.staff.length;
      i++
    ) {

      const staff =
        appData.staff[i];

      console.log(
        "★ 職員並び順RPC更新開始",
        {
          index: i,
          id: staff.id,
          name: getStaffName(staff),
          sort_order: i
        }
      );

      const result =
        await supabaseClient.rpc(
          "update_staff_sort_order",
          {
            p_staff_id:
              staff.id,

            p_sort_order:
              i
          }
        );

      console.log(
        "★ 職員並び順RPC結果",
        result
      );

      if (
        result.error
      ) {

        console.error(
          "★ 職員並び順RPC更新失敗",
          result.error
        );

        throw result.error;
      }

      staff.sort_order =
        i;

      console.log(
        "★ 職員並び順RPC更新成功",
        staff.id,
        i
      );

    }

    console.log(
      "★★★ 職員並び順RPC保存成功 ★★★"
    );

    return true;

  } catch (error) {

    console.error(
      "★★★ 職員並び順RPC保存エラー ★★★",
      error
    );

    return false;

  }

}
/* =========================================================
   職員を上下に移動
========================================================= */

async function moveStaff(
  index,
  direction
) {

  const newIndex =
    index +
    direction;

  /*
   * 範囲外なら何もしない
   */
  if (
    newIndex < 0 ||
    newIndex >=
      appData.staff.length
  ) {
    return;
  }

  /*
   * 他のクラウド処理中なら何もしない
   */
  if (
    cloudOperationBusy
  ) {
    return;
  }

  /*
   * 現在の並びを入れ替える
   */
  [
    appData.staff[index],
    appData.staff[newIndex]
  ] = [
    appData.staff[newIndex],
    appData.staff[index]
  ];

  /*
   * 画面上の並び順を更新
   */
  appData.staff =
    appData.staff.map(
      (staff, i) => ({
        ...staff,
        sort_order: i
      })
    );

  /*
   * まず画面を即時更新
   */
  renderStaffList();
  renderSchedule();

  cloudOperationBusy =
    true;

  try {

    /*
     * Supabaseへ保存
     */
    const saved =
      await saveStaffOrder();

    if (
      !saved
    ) {

      throw new Error(
        "並び順保存失敗"
      );

    }

  } catch (error) {

    console.error(
      "職員並び順変更エラー",
      error
    );

    alert(
      "職員の並び順の保存に失敗しました。"
    );

    /*
     * 保存に失敗した場合は
     * Supabase上の状態へ戻す
     */
    await loadAllFromSupabase();

    renderStaffList();
    renderSchedule();

  } finally {

    finishCloudOperation();

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


  /* =========================================
     並び順を入れ替える
     ========================================= */

  [
    appData.staff[index],
    appData.staff[newIndex]
  ] = [

    appData.staff[newIndex],
    appData.staff[index]

  ];


  /* =========================================
     新しい並び順を設定
     ========================================= */

  appData.staff =
    appData.staff.map(
      (staff, i) => ({

        ...staff,

        sort_order:
          i

      })
    );


  /* =========================================
     画面を先に更新
     ========================================= */

  renderStaffList();

  renderSchedule();


  cloudOperationBusy =
    true;


  try {

    const saved =
      await saveStaffOrder();


    if (!saved) {

      throw new Error(
        "並び順保存失敗"
      );

    }


  } catch (error) {

    console.error(
      "職員並び順変更エラー",
      error
    );


    alert(
      "職員の並び順の保存に失敗しました。"
    );


    /* -----------------------------------------
       保存失敗時はSupabaseの状態へ戻す
       ----------------------------------------- */

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
  await supabaseClient.rpc(
    "update_shift_type",
    {
      p_shift_id:
        oldShift.id,

      p_old_name:
        oldName,

      p_new_name:
        name,

      p_start_time:
        start,

      p_end_time:
        end,

      p_break_time:
        breakTime
    }
  );


console.log(
  "★ 勤務形態編集RPC結果",
  result
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
        breakTime || null,

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

    return;

  }


  /* =====================================================
     職員ごとの権限情報を取得
     
     ※重要
     ここでは現在表示されている職員一覧を消さない。
     Supabaseから取得している間も、現在の一覧を表示したままにする。
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

    if (error) {
      throw error;
    }

    members =
      data || [];

  } catch (error) {

    console.error(
      "職員権限情報取得エラー",
      error
    );

    alert(
      "職員の権限情報を取得できませんでした。\n\n" +
      error.message
    );

    /*
     * 取得に失敗しても、
     * 現在表示されている一覧は消さない
     */

    return;
  }


  /* =====================================================
     現在のユーザーが管理者か
  ===================================================== */

  const isAdmin =
    currentOrganization &&
    currentOrganization.role === "admin";


  /* =====================================================
     新しい職員一覧を一時的に作成
     
     ※ここでも現在の画面は変更しない
  ===================================================== */

  const newList =
    document.createDocumentFragment();


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
                ${
                  index ===
                  appData.staff.length - 1
                    ? "disabled"
                    : ""
                }
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
                  await supabaseClient
                    .rpc(
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
         新しい一覧へ追加
      ================================================= */

      newList.appendChild(
        item
      );

    }
  );


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


  /* =====================================================
     ここで初めて画面を入れ替える
     
     重要：
     Supabase取得・職員一覧作成が全部終わった後なので、
     「職員が一瞬消える」時間が発生しない。
  ===================================================== */

  list.replaceChildren(
    newList
  );

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
    document.getElementById("leaveNameInput");

  const colorInput =
    document.getElementById("leaveColorInput");

  if (!nameInput) {
    return;
  }

  const name =
    nameInput.value.trim();

  const color =
    colorInput?.value || "#FFD54F";

  if (!name) {

    alert(
      "休暇名を入力してください"
    );

    return;
  }

  /* ==================================================
     重複チェック
  ================================================== */

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

  cloudOperationBusy = true;

  try {

    /* ==================================================
       編集
    ================================================== */

    if (editingLeaveId) {

      const oldLeave =
        appData.leaveTypes.find(
          leave =>
            String(leave.id) ===
            String(editingLeaveId)
        );

      console.log(
        "★ 休暇名編集開始",
        {
          id: editingLeaveId,
          oldName:
            oldLeave
              ? oldLeave.name
              : "",
          newName: name,
          color
        }
      );

      const result =
        await supabaseClient.rpc(
          "update_leave_type",
          {
            p_leave_id:
              editingLeaveId,

            p_old_name:
              oldLeave
                ? oldLeave.name
                : name,

            p_new_name:
              name,

            p_color:
              color
          }
        );

      console.log(
        "★ 休暇名編集RPC結果",
        result
      );

      if (result.error) {
        throw result.error;
      }

      editingLeaveId = null;

      console.log(
        "★ 休暇名編集成功"
      );

    }

    /* ==================================================
       新規追加
    ================================================== */

    else {

      console.log(
        "★ 休暇新規追加開始",
        {
          name,
          color
        }
      );

      const result =
        await supabaseClient
          .from("leave_types")
          .insert({
            name,
            color,
            organization_id:
              currentOrganization.id
          });

      console.log(
        "★ 休暇新規追加結果",
        result
      );

      if (result.error) {
        throw result.error;
      }

      console.log(
        "★ 休暇新規追加成功"
      );
    }

    /* ==================================================
       入力欄をリセット
    ================================================== */

    nameInput.value = "";

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

    /* ==================================================
       Supabaseから再読み込み
    ================================================== */

    await loadAllFromSupabase();

    /* ==================================================
       画面再描画
    ================================================== */

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

              console.log(
                "★ 休暇削除RPC開始",
                {
                  id: leave.id,
                  name: leave.name
                }
              );


              /* =================================================
                 休暇削除RPC
              ================================================= */

              const result =
                await supabaseClient.rpc(
                  "delete_leave_type",
                  {
                    p_leave_id:
                      leave.id,

                    p_leave_name:
                      leave.name
                  }
                );


              console.log(
                "★ 休暇削除RPC結果",
                result
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


              console.log(
                "★ 休暇削除成功"
              );


              /* =================================================
                 Supabaseから再読み込み
              ================================================= */

              await loadAllFromSupabase();


              /* =================================================
                 画面再描画
              ================================================= */

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

       console.log(
  "★ 休業設定編集ID",
  editingHolidayId
);

      const result =
  await supabaseClient.rpc(
    "update_company_holiday",
    {
      p_holiday_id:
        editingHolidayId,

      p_name:
        name,

      p_start_date:
        start,

      p_end_date:
        end
    }
  );


console.log(
  "★ 休業設定編集RPC結果",
  result
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

/* =========================================================
   ダークモード
   ========================================================= */

function setupDarkMode() {

  const button =
    document.getElementById("darkModeButton");

  if (!button) {
    return;
  }

  // 保存されている設定を読み込む
  const savedMode =
    localStorage.getItem("darkMode");

  if (savedMode === "true") {
    document.body.classList.add(
      "dark-mode"
    );

    updateDarkModeButton(true);

  } else {
    document.body.classList.remove(
      "dark-mode"
    );

    updateDarkModeButton(false);
  }

  button.onclick = function() {

    const isDark =
      document.body.classList.toggle(
        "dark-mode"
      );

    localStorage.setItem(
      "darkMode",
      isDark ? "true" : "false"
    );

    updateDarkModeButton(isDark);
  };
}


/* ---------------------------------------------------------
   ダークモードボタン表示
--------------------------------------------------------- */

function updateDarkModeButton(isDark) {

  const button =
    document.getElementById(
      "darkModeButton"
    );

  if (!button) {
    return;
  }

  if (isDark) {

    button.setAttribute(
      "aria-label",
      "ライトモード"
    );

    button.setAttribute(
      "title",
      "ライトモード"
    );

    button.innerHTML = `
      <svg
        class="dark-mode-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />

        <path
          d="
            M12 2
            V4
            M12 20
            V22
            M4.93 4.93
            L6.34 6.34
            M17.66 17.66
            L19.07 19.07
            M2 12
            H4
            M20 12
            H22
            M4.93 19.07
            L6.34 17.66
            M17.66 6.34
            L19.07 4.93
          "
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    `;

  } else {

    button.setAttribute(
      "aria-label",
      "ダークモード"
    );

    button.setAttribute(
      "title",
      "ダークモード"
    );

    button.innerHTML = `
      <svg
        class="dark-mode-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="
            M20.5 15.5
            A8.5 8.5 0 0 1
            8.5 3.5
            A8.5 8.5 0 1 0
            20.5 15.5Z
          "
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }
}
