import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./lib/supabase";
import "./App.css";

const LEVELS = [
  {
    id: 1,
    number: 1,
    name: "THE LOGIC VAULT",
    subtitle: "TECHNICAL INTELLIGENCE",
    time: 480,
    qualification: 60,
  },
  {
    id: 2,
    number: 2,
    name: "THE CODE CHAMBER",
    subtitle: "JUMBLED CODE",
    time: 480,
    qualification: 60,
  },
  {
    id: 3,
    number: 3,
    name: "THE PATTERN VAULT",
    subtitle: "REGEX INTELLIGENCE",
    time: 480,
    qualification: 60,
  },
  {
    id: 4,
    number: 4,
    name: "THE BREACH ROOM",
    subtitle: "DEBUG & DECODE",
    time: 480,
    qualification: 60,
  },
  {
    id: 5,
    number: 5,
    name: "THE FINAL LOCK",
    subtitle: "ULTIMATE CHALLENGE",
    time: 480,
    qualification: 60,
  },
];

const PASSWORDS = {
  2: "PHOENIX",
  3: "MATRIX",
  4: "OVERRIDE",
  5: "FREEDOM",
  FINAL: "2468",
};

const HINTS = {
  2: "A BIRD WHICH RISES FROM ASHES.",
  3: "A RECTANGLE WITH ROWS AND COLUMNS.",
  4: "YOU SAY IT ONCE. I MAKE IT HAPPEN AGAIN AND AGAIN.",
  5: "THE THING YOU GET AFTER YOU ARE LEFT FREE.",
  FINAL: "THE FIRST FOUR EVEN DIGITS.",
};

const shuffleArray = (array) => {
  const copy = [...array];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));

    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  return copy;
};

const formatTime = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  return mm + ":" + ss;
};

function App() {
  const [screen, setScreen] = useState("landing");

  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [participantId, setParticipantId] = useState(null);

  const [currentLevel, setCurrentLevel] = useState(1);
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);

  const [selectedOption, setSelectedOption] = useState(null);
  const [levelScore, setLevelScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(480);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [doorState, setDoorState] = useState("locked");

  const [tabSwitches, setTabSwitches] = useState(0);
  const [fullscreenExits, setFullscreenExits] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenOverlay, setShowFullscreenOverlay] =
    useState(false);

  const [finalMessage, setFinalMessage] = useState("");

  const currentLevelInfo = useMemo(() => {
    return LEVELS.find((level) => level.id === currentLevel);
  }, [currentLevel]);

  const currentQuestion = questions[questionIndex];

  const isFinalDoor = currentLevel === 5;
  const nextLevel = currentLevel + 1;

  const doorKey = isFinalDoor ? "FINAL" : String(currentLevel + 1);

  const doorPassword = PASSWORDS[doorKey];
  const doorHint = HINTS[doorKey];

  /* =========================================================
     FULLSCREEN
  ========================================================= */

  const enterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }

      setIsFullscreen(true);
      setShowFullscreenOverlay(false);
    } catch (fullscreenError) {
      console.error("FULLSCREEN FAILED:", fullscreenError);

      setIsFullscreen(false);
      setShowFullscreenOverlay(true);
    }
  };

  /* =========================================================
     FULLSCREEN CHANGE
  ========================================================= */

  useEffect(() => {
    const handleFullscreenChange = async () => {
      const fullscreenActive =
        document.fullscreenElement !== null;

      setIsFullscreen(fullscreenActive);

      if (fullscreenActive) {
        setShowFullscreenOverlay(false);
        return;
      }

      const gameplayScreens = [
        "mission",
        "challenge",
        "result",
        "door",
        "final",
      ];

      if (
        participantId &&
        gameplayScreens.includes(screen)
      ) {
        setFullscreenExits((previous) => previous + 1);
        setShowFullscreenOverlay(true);

        const { error: eventError } = await supabase
          .from("activity_events")
          .insert({
            participant_id: participantId,
            event_type: "fullscreen_exit",
            level_id: currentLevel,
            metadata: {
              screen: screen,
            },
          });

        if (eventError) {
          console.error(
            "FULLSCREEN EVENT ERROR:",
            eventError
          );
        }
      }
    };

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, [screen, participantId, currentLevel]);

  /* =========================================================
     TAB SWITCH DETECTION
  ========================================================= */

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === "hidden" &&
        participantId &&
        [
          "mission",
          "challenge",
          "result",
          "door",
          "final",
        ].includes(screen)
      ) {
        setTabSwitches((previous) => previous + 1);

        const { error: tabError } = await supabase
          .from("activity_events")
          .insert({
            participant_id: participantId,
            event_type: "tab_switch",
            level_id: currentLevel,
            metadata: {
              visibility: "hidden",
            },
          });

        if (tabError) {
          console.error(
            "TAB SWITCH EVENT ERROR:",
            tabError
          );
        }
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [participantId, currentLevel, screen]);

  /* =========================================================
     TIMER
  ========================================================= */

  useEffect(() => {
    if (screen !== "challenge") {
      return undefined;
    }

    if (timeLeft <= 0) {
      finishLevel(true);
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [screen, timeLeft]);

  /* =========================================================
     REGISTER PARTICIPANT
  ========================================================= */

  const registerParticipant = async () => {
    setError("");

    const cleanName = name.trim();
    const cleanRoll = rollNumber.trim().toUpperCase();

    if (!cleanName) {
      setError("PLEASE ENTER YOUR NAME.");
      return;
    }

    if (!cleanRoll) {
      setError("PLEASE ENTER YOUR ROLL NUMBER.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: existing,
        error: lookupError,
      } = await supabase
        .from("participants")
        .select("id, name, roll_number, status")
        .eq("roll_number", cleanRoll)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existing) {
        setError(
          "THIS ROLL NUMBER HAS ALREADY REGISTERED. EACH PARTICIPANT CAN ENTER ONLY ONCE."
        );

        setLoading(false);
        return;
      }

      const {
        data,
        error: insertError,
      } = await supabase
        .from("participants")
        .insert({
          name: cleanName,
          roll_number: cleanRoll,
          status: "started",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          setError(
            "THIS ROLL NUMBER HAS ALREADY REGISTERED. EACH PARTICIPANT CAN ENTER ONLY ONCE."
          );

          setLoading(false);
          return;
        }

        throw insertError;
      }

      setParticipantId(data.id);
      setName(data.name);
      setRollNumber(data.roll_number);

      setCurrentLevel(1);
      setLevelScore(0);
      setQuestionIndex(0);
      setQuestions([]);
      setTabSwitches(0);
      setFullscreenExits(0);

      const {
        error: registrationEventError,
      } = await supabase
        .from("activity_events")
        .insert({
          participant_id: data.id,
          event_type: "registration",
          level_id: null,
          metadata: {
            name: data.name,
            roll_number: data.roll_number,
          },
        });

      if (registrationEventError) {
        console.error(
          "REGISTRATION EVENT ERROR:",
          registrationEventError
        );
      }

      await enterFullscreen();

      setScreen("mission");
    } catch (registrationError) {
      console.error(
        "REGISTRATION ERROR:",
        registrationError
      );

      setError(
        registrationError &&
          registrationError.message
          ? registrationError.message
          : "REGISTRATION FAILED. PLEASE CONTACT THE ORGANIZER."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     LOAD QUESTIONS
  ========================================================= */

  const loadQuestions = async (levelId) => {
    setLoading(true);
    setError("");

    try {
      const {
        data,
        error: questionError,
      } = await supabase
        .from("questions")
        .select("*")
        .eq("level_id", levelId)
        .order("question_number", {
          ascending: true,
        });

      if (questionError) {
        throw questionError;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "NO QUESTIONS FOUND FOR LEVEL " +
            String(levelId) +
            "."
        );
      }

      const randomized = shuffleArray(data).map(
        (question) => {
          const options = Array.isArray(question.options)
            ? question.options
            : [];

          const indexedOptions = options.map(
            (option, index) => ({
              option: option,
              originalIndex: index,
            })
          );

          const shuffledOptions =
            shuffleArray(indexedOptions);

          const displayCorrectOption =
            shuffledOptions.findIndex(
              (item) =>
                item.originalIndex ===
                question.correct_option
            );

          return {
            ...question,
            displayOptions:
              shuffledOptions.map(
                (item) => item.option
              ),
            displayCorrectOption:
              displayCorrectOption,
          };
        }
      );

      setQuestions(randomized);
      setQuestionIndex(0);
    } catch (questionLoadError) {
      console.error(
        "QUESTION LOAD ERROR:",
        questionLoadError
      );

      setError(
        questionLoadError &&
          questionLoadError.message
          ? questionLoadError.message
          : "QUESTIONS COULD NOT BE LOADED."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     START LEVEL
  ========================================================= */

  const startLevel = async (
    levelId = currentLevel
  ) => {
    setError("");
    setSelectedOption(null);
    setLevelScore(0);
    setPassword("");
    setPasswordAttempts(0);
    setDoorState("locked");

    const level = LEVELS.find(
      (item) => item.id === levelId
    );

    if (!level) {
      return;
    }

    if (!participantId) {
      setError(
        "PARTICIPANT SESSION LOST. PLEASE CONTACT THE ORGANIZER."
      );
      return;
    }

    setTimeLeft(level.time);

    await loadQuestions(levelId);

    if (!document.fullscreenElement) {
      await enterFullscreen();
    }

    setScreen("challenge");

    const {
      error: startEventError,
    } = await supabase
      .from("activity_events")
      .insert({
        participant_id: participantId,
        event_type: "level_started",
        level_id: levelId,
        metadata: {
          level_name: level.name,
        },
      });

    if (startEventError) {
      console.error(
        "LEVEL START EVENT ERROR:",
        startEventError
      );
    }

    const {
      error: levelStartResultError,
    } = await supabase
      .from("level_results")
      .upsert(
        {
          participant_id: participantId,
          level_id: levelId,
          score: 0,
          time_seconds: 0,
          password_attempts: 0,
          status: "in_progress",
          completed_at: null,
        },
        {
          onConflict:
            "participant_id,level_id",
        }
      );

    if (levelStartResultError) {
      console.error(
        "LEVEL START RESULT ERROR:",
        levelStartResultError
      );
    }
  };

  /* =========================================================
     SUBMIT QUESTION
  ========================================================= */

  const submitQuestion = async () => {
    if (
      selectedOption === null ||
      !currentQuestion
    ) {
      setError(
        "SELECT AN ANSWER BEFORE CONTINUING."
      );
      return;
    }

    if (!participantId) {
      setError(
        "PARTICIPANT SESSION LOST. PLEASE CONTACT THE ORGANIZER."
      );
      return;
    }

    setError("");

    const isCorrect =
      selectedOption ===
      currentQuestion.displayCorrectOption;

    const questionScore = isCorrect
      ? Number(currentQuestion.marks || 10)
      : 0;

    const nextScore =
      Number(levelScore) + questionScore;

    const {
      error: attemptError,
    } = await supabase
      .from("question_attempts")
      .insert({
        participant_id: participantId,
        level_id: currentLevel,
        question_id: currentQuestion.id,
        selected_option: selectedOption,
        is_correct: isCorrect,
      });

    if (attemptError) {
      console.error(
        "QUESTION ATTEMPT SAVE ERROR:",
        attemptError
      );
    }

    if (
      questionIndex <
      questions.length - 1
    ) {
      setLevelScore(nextScore);
      setQuestionIndex(
        (previous) => previous + 1
      );
      setSelectedOption(null);
      return;
    }

    await finishLevel(
      false,
      nextScore
    );
  };

  /* =========================================================
     FINISH LEVEL
  ========================================================= */

  const finishLevel = async (
    timeExpired = false,
    scoreOverride = null
  ) => {
    const finalScore =
      scoreOverride !== null
        ? Number(scoreOverride)
        : Number(levelScore);

    const elapsedTime =
      Number(currentLevelInfo.time) -
      Number(timeLeft);

    const safeTime = Math.max(
      0,
      elapsedTime
    );

    const qualified =
      finalScore >=
      currentLevelInfo.qualification;

    console.log(
      "========== SAVING LEVEL RESULT =========="
    );
    console.log(
      "Participant ID:",
      participantId
    );
    console.log(
      "Level:",
      currentLevel
    );
    console.log(
      "Score:",
      finalScore
    );
    console.log(
      "Time:",
      safeTime
    );
    console.log(
      "Qualified:",
      qualified
    );
    console.log(
      "=========================================="
    );

    if (!participantId) {
      console.error(
        "LEVEL RESULT NOT SAVED: participantId is missing."
      );

      setError(
        "PARTICIPANT SESSION LOST. PLEASE CONTACT THE ORGANIZER."
      );

      return;
    }

    try {
      const {
        data: savedResult,
        error: resultError,
      } = await supabase
        .from("level_results")
        .upsert(
          {
            participant_id: participantId,
            level_id: currentLevel,
            score: finalScore,
            time_seconds: safeTime,
            password_attempts:
              passwordAttempts,
            status: qualified
              ? "qualified"
              : "failed",
            completed_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "participant_id,level_id",
          }
        )
        .select()
        .single();

      if (resultError) {
        console.error(
          "LEVEL RESULT SAVE ERROR:",
          resultError
        );

        setError(
          "DATABASE ERROR: " +
            resultError.message
        );

        return;
      }

      console.log(
        "LEVEL RESULT SAVED:",
        savedResult
      );

      const {
        error: completionEventError,
      } = await supabase
        .from("activity_events")
        .insert({
          participant_id: participantId,
          event_type: "level_completed",
          level_id: currentLevel,
          metadata: {
            score: finalScore,
            time_seconds: safeTime,
            time_expired: timeExpired,
            qualified: qualified,
          },
        });

      if (completionEventError) {
        console.error(
          "LEVEL COMPLETION EVENT ERROR:",
          completionEventError
        );
      }

      const {
        error: participantStatusError,
      } = await supabase
        .from("participants")
        .update({
          status: qualified
            ? "in_progress"
            : "failed",
        })
        .eq("id", participantId);

      if (participantStatusError) {
        console.error(
          "PARTICIPANT STATUS UPDATE ERROR:",
          participantStatusError
        );
      }

      setLevelScore(finalScore);
      setScreen("result");
    } catch (saveError) {
      console.error(
        "UNEXPECTED LEVEL SAVE ERROR:",
        saveError
      );

      setError(
        saveError &&
          saveError.message
          ? saveError.message
          : "LEVEL RESULT COULD NOT BE SAVED."
      );
    }
  };

  /* =========================================================
     OPEN DOOR
  ========================================================= */

  const openDoor = async () => {
    if (doorState === "permanent") {
      return;
    }

    const entered =
      password.trim().toUpperCase();

    if (!entered) {
      setError("ENTER THE PASSWORD.");
      return;
    }

    if (!participantId) {
      setError(
        "PARTICIPANT SESSION LOST. PLEASE CONTACT THE ORGANIZER."
      );
      return;
    }

    const attemptNumber =
      passwordAttempts + 1;

    const correct =
      entered === doorPassword;

    const {
      error: doorAttemptError,
    } = await supabase
      .from("door_attempts")
      .insert({
        participant_id: participantId,
        level_id: currentLevel,
        attempt_number: attemptNumber,
        success: correct,
      });

    if (doorAttemptError) {
      console.error(
        "DOOR ATTEMPT SAVE ERROR:",
        doorAttemptError
      );
    }

    const {
      error: passwordEventError,
    } = await supabase
      .from("activity_events")
      .insert({
        participant_id: participantId,
        event_type: correct
          ? "password_success"
          : "password_failure",
        level_id: currentLevel,
        metadata: {
          attempt_number:
            attemptNumber,
          success: correct,
        },
      });

    if (passwordEventError) {
      console.error(
        "PASSWORD EVENT ERROR:",
        passwordEventError
      );
    }

    if (correct) {
      setPasswordAttempts(
        attemptNumber
      );

      setDoorState("opening");
      setError("");

      const {
        error: resultUpdateError,
      } = await supabase
        .from("level_results")
        .update({
          password_attempts:
            attemptNumber,
          status: "completed",
          completed_at:
            new Date().toISOString(),
        })
        .eq(
          "participant_id",
          participantId
        )
        .eq(
          "level_id",
          currentLevel
        );

      if (resultUpdateError) {
        console.error(
          "PASSWORD RESULT UPDATE ERROR:",
          resultUpdateError
        );
      }

      setTimeout(async () => {
        if (isFinalDoor) {
          await completeEscape();
          return;
        }

        setCurrentLevel(nextLevel);
        setPassword("");
        setPasswordAttempts(0);
        setDoorState("locked");
        setScreen("mission");
      }, 2800);

      return;
    }

    setPasswordAttempts(
      attemptNumber
    );

    setPassword("");

    if (attemptNumber >= 3) {
      setDoorState("permanent");

      setError(
        "THREE FAILED ATTEMPTS. THIS DOOR IS PERMANENTLY LOCKED."
      );

      const {
        error: lockError,
      } = await supabase
        .from("level_results")
        .update({
          password_attempts: 3,
          status: "door_locked",
        })
        .eq(
          "participant_id",
          participantId
        )
        .eq(
          "level_id",
          currentLevel
        );

      if (lockError) {
        console.error(
          "DOOR LOCK RESULT UPDATE ERROR:",
          lockError
        );
      }
    } else {
      setDoorState("denied");

      setError(
        "ACCESS DENIED. " +
          String(
            3 - attemptNumber
          ) +
          " ATTEMPT" +
          (3 - attemptNumber === 1
            ? ""
            : "S") +
          " REMAINING."
      );

      setTimeout(() => {
        setDoorState("locked");
        setError("");
      }, 1500);
    }
  };

  /* =========================================================
     COMPLETE ESCAPE
  ========================================================= */

  const completeEscape = async () => {
    if (!participantId) {
      setError(
        "PARTICIPANT SESSION LOST. PLEASE CONTACT THE ORGANIZER."
      );
      return;
    }

    try {
      const {
        error: participantError,
      } = await supabase
        .from("participants")
        .update({
          status: "completed",
          completed_at:
            new Date().toISOString(),
        })
        .eq("id", participantId);

      if (participantError) {
        console.error(
          "FINAL PARTICIPANT UPDATE ERROR:",
          participantError
        );
      }

      const {
        error: finalEventError,
      } = await supabase
        .from("activity_events")
        .insert({
          participant_id: participantId,
          event_type: "escape_completed",
          level_id: 5,
          metadata: {
            final: true,
          },
        });

      if (finalEventError) {
        console.error(
          "FINAL ESCAPE EVENT ERROR:",
          finalEventError
        );
      }
    } catch (finalError) {
      console.error(
        "FINAL ESCAPE ERROR:",
        finalError
      );
    }

    setFinalMessage(
      "FINAL LOCK DEFEATED"
    );

    setScreen("final");
  };

  /* =========================================================
     RESET
  ========================================================= */

  const resetGame = () => {
    setScreen("landing");

    setName("");
    setRollNumber("");
    setParticipantId(null);

    setCurrentLevel(1);
    setQuestions([]);
    setQuestionIndex(0);

    setSelectedOption(null);
    setLevelScore(0);
    setTimeLeft(480);

    setError("");
    setLoading(false);

    setPassword("");
    setPasswordAttempts(0);
    setDoorState("locked");

    setTabSwitches(0);
    setFullscreenExits(0);

    setFinalMessage("");
    setShowFullscreenOverlay(false);
    setIsFullscreen(false);
  };

  /* =========================================================
     FULLSCREEN OVERLAY
  ========================================================= */

  const FullscreenOverlay = () => {
    if (!showFullscreenOverlay) {
      return null;
    }

    return (
      <div className="fullscreen-overlay">
        <motion.div
          className="fullscreen-overlay-content"
          initial={{
            opacity: 0,
            scale: 0.85,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
        >
          <div className="fullscreen-danger">
            ⚠ SECURITY VIOLATION
          </div>

          <h1>
            FULLSCREEN REQUIRED
          </h1>

          <div className="fullscreen-line" />

          <p>
            THE ESCAPE PROTOCOL CANNOT
            CONTINUE OUTSIDE THE SECURE
            DISPLAY.
          </p>

          <p>
            RETURN TO FULLSCREEN TO
            CONTINUE.
          </p>

          <div className="fullscreen-count">
            FULLSCREEN EXITS:{" "}
            {fullscreenExits}
          </div>

          <button
            className="enter-button fullscreen-return"
            onClick={enterFullscreen}
          >
            RETURN TO FULLSCREEN
          </button>
        </motion.div>
      </div>
    );
  };

  /* =========================================================
     LANDING
  ========================================================= */

  if (screen === "landing") {
    return (
      <div className="app landing-screen">
        <div className="landing-noise" />

        <motion.div
          className="landing-content"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 1.5,
          }}
        >
          <div className="system-warning">
            ⚠ SYSTEM LOCKED
          </div>

          <h1>ESCAPE</h1>
          <h2>PROTOCOL</h2>

          <div className="landing-line" />

          <p className="landing-warning">
            FIVE LOCKS. ONE ESCAPE.
          </p>

          <button
            className="enter-button"
            onClick={() => {
              setError("");
              setScreen("registration");
            }}
          >
            ENTER
          </button>
        </motion.div>
      </div>
    );
  }

  /* =========================================================
     REGISTRATION
  ========================================================= */

  if (screen === "registration") {
    return (
      <div className="app registration-screen">
        <div className="registration-card">
          <div className="security-label">
            SECURITY NODE // 01
          </div>

          <h1>
            IDENTITY VERIFICATION
          </h1>

          <p className="registration-subtitle">
            ENTER YOUR PARTICIPATION DETAILS
          </p>

          <div className="input-group">
            <label>FULL NAME</label>

            <input
              type="text"
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              placeholder="ENTER NAME"
              autoComplete="off"
            />
          </div>

          <div className="input-group">
            <label>ROLL NUMBER</label>

            <input
              type="text"
              value={rollNumber}
              onChange={(event) =>
                setRollNumber(
                  event.target.value.toUpperCase()
                )
              }
              placeholder="ENTER ROLL NUMBER"
              autoComplete="off"
            />
          </div>

          {error && (
            <motion.div
              className="error-message registration-error"
              initial={{
                opacity: 0,
                y: -10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
            >
              {error}
            </motion.div>
          )}

          <button
            className="enter-button registration-button"
            onClick={
              registerParticipant
            }
            disabled={loading}
          >
            {loading
              ? "VERIFYING..."
              : "INITIALIZE ESCAPE"}
          </button>

          <div className="registration-note">
            ONE ROLL NUMBER = ONE
            PARTICIPATION
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     MISSION
  ========================================================= */

  if (screen === "mission") {
    return (
      <>
        <div className="app mission-screen">
          <div className="scanlines" />

          <div className="mission-header">
            <span>
              ESCAPE PROTOCOL
            </span>

            <span>
              SECURITY NODE // 0
              {currentLevel}
            </span>
          </div>

          <motion.div
            className="mission-center"
            initial={{
              opacity: 0,
              scale: 0.9,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
          >
            <div className="lock-number">
              LOCK{" "}
              {String(currentLevel).padStart(
                2,
                "0"
              )}
            </div>

            <h1>
              LEVEL{" "}
              {String(currentLevel).padStart(
                2,
                "0"
              )}
            </h1>

            <div className="mission-divider" />

            <h2>
              {currentLevelInfo.name}
            </h2>

            <p>
              {currentLevelInfo.subtitle}
            </p>

            <div className="mission-terminal">
              <span>
                ACCESS GRANTED
              </span>

              <span>
                SECURE CONNECTION
              </span>

              <span>
                NO EXIT DETECTED
              </span>
            </div>

            <button
              className="enter-button"
              onClick={() =>
                startLevel(
                  currentLevel
                )
              }
            >
              ENTER LEVEL{" "}
              {String(currentLevel).padStart(
                2,
                "0"
              )}
            </button>
          </motion.div>
        </div>

        <FullscreenOverlay />
      </>
    );
  }

  /* =========================================================
     CHALLENGE
  ========================================================= */

  if (screen === "challenge") {
    return (
      <>
        <div className="app challenge-screen">
          <div className="challenge-topbar">
            <div>
              <span className="top-label">
                ESCAPE PROTOCOL
              </span>

              <strong>
                LOCK{" "}
                {String(currentLevel).padStart(
                  2,
                  "0"
                )}
              </strong>
            </div>

            <div className="timer-box">
              <span>
                TIME REMAINING
              </span>

              <strong>
                {formatTime(timeLeft)}
              </strong>
            </div>
          </div>

          <div className="challenge-progress">
            QUESTION{" "}
            {questionIndex + 1} /{" "}
            {questions.length}
          </div>

          <motion.div
            className="question-card"
            key={
              currentQuestion?.id ||
              questionIndex
            }
            initial={{
              opacity: 0,
              x: 35,
            }}
            animate={{
              opacity: 1,
              x: 0,
            }}
          >
            {currentQuestion && (
              <>
                <div className="question-number">
                  QUERY //{" "}
                  {String(
                    questionIndex + 1
                  ).padStart(
                    2,
                    "0"
                  )}
                </div>

                <h1>
                  {
                    currentQuestion.question_text
                  }
                </h1>

                {currentQuestion.code_snippet && (
                  <pre className="code-box">
                    {
                      currentQuestion.code_snippet
                    }
                  </pre>
                )}

                <div className="options-container">
                  {currentQuestion.displayOptions.map(
                    (
                      option,
                      index
                    ) => (
                      <button
                        key={
                          currentQuestion.id +
                          "-" +
                          index
                        }
                        className={
                          "option-button " +
                          (selectedOption ===
                          index
                            ? "selected"
                            : "")
                        }
                        onClick={() =>
                          setSelectedOption(
                            index
                          )
                        }
                      >
                        <span className="option-letter">
                          {String.fromCharCode(
                            65 + index
                          )}
                        </span>

                        <span>
                          {option}
                        </span>
                      </button>
                    )
                  )}
                </div>

                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                <button
                  className="next-button"
                  onClick={
                    submitQuestion
                  }
                >
                  {questionIndex ===
                  questions.length - 1
                    ? "SUBMIT LEVEL"
                    : "NEXT"}
                </button>
              </>
            )}
          </motion.div>

          <div className="security-footer">
            TAB SWITCHES:{" "}
            {tabSwitches}
            &nbsp; // &nbsp;
            FULLSCREEN EXITS:{" "}
            {fullscreenExits}
          </div>
        </div>

        <FullscreenOverlay />
      </>
    );
  }

  /* =========================================================
     RESULT
  ========================================================= */

  if (screen === "result") {
    const qualified =
      levelScore >=
      currentLevelInfo.qualification;

    return (
      <>
        <div className="app result-screen">
          <motion.div
            className="result-card"
            initial={{
              opacity: 0,
              scale: 0.85,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
          >
            <div className="result-label">
              LOCK{" "}
              {String(currentLevel).padStart(
                2,
                "0"
              )}{" "}
              ANALYSIS
            </div>

            <h1>
              {qualified
                ? "ACCESS CONDITION SATISFIED"
                : "ACCESS CONDITION FAILED"}
            </h1>

            <div className="result-line" />

            <div className="result-status">
              {qualified
                ? "QUALIFIED"
                : "NOT QUALIFIED"}
            </div>

            <p className="result-message">
              {qualified
                ? "THE NEXT LOCK AWAITS."
                : "THE PROTOCOL HAS REJECTED YOUR CURRENT SCORE."}
            </p>

            {!qualified ? (
              <button
                className="enter-button"
                onClick={
                  resetGame
                }
              >
                EXIT PROTOCOL
              </button>
            ) : (
              <button
                className="enter-button"
                onClick={() =>
                  setScreen("door")
                }
              >
                PROCEED TO LOCK
              </button>
            )}
          </motion.div>
        </div>

        <FullscreenOverlay />
      </>
    );
  }

  /* =========================================================
     DOOR
  ========================================================= */

  if (screen === "door") {
    const remainingAttempts =
      Math.max(
        0,
        3 - passwordAttempts
      );

    return (
      <>
        <div
          className={
            "app door-screen " +
            (doorState === "denied"
              ? "door-denied"
              : doorState === "opening"
              ? "door-opening"
              : doorState === "permanent"
              ? "door-permanent"
              : "")
          }
        >
          <div className="door-fog fog-one" />
          <div className="door-fog fog-two" />

          <div className="door-warning">
            <span>⚠</span>
            SECURITY LOCK ACTIVE
          </div>

          <motion.div
            className="door-container"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
          >
            <div className="door-top-label">
              SECURITY NODE //{" "}
              {String(currentLevel).padStart(
                2,
                "0"
              )}
            </div>

            <div className="metal-door">
              <div className="door-scratches" />

              <div className="door-sign">
                {isFinalDoor
                  ? "FINAL EXIT"
                  : "LOCK " +
                    String(
                      currentLevel
                    ).padStart(
                      2,
                      "0"
                    )}
              </div>

              <motion.div
                className="combination-wheel"
                animate={
                  doorState ===
                  "opening"
                    ? {
                        rotate: 360,
                        scale: 1.15,
                      }
                    : {
                        rotate: 0,
                      }
                }
                transition={{
                  duration: 1.5,
                  ease: "easeInOut",
                }}
              >
                <div className="wheel-ring ring-one">
                  <span>0</span>
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                  <span>7</span>
                </div>

                <div className="wheel-ring ring-two">
                  <span>8</span>
                  <span>9</span>
                  <span>A</span>
                  <span>B</span>
                  <span>C</span>
                  <span>D</span>
                  <span>E</span>
                  <span>F</span>
                </div>

                <div className="wheel-center">
                  <span>LOCK</span>
                </div>
              </motion.div>

              <div className="door-handle" />
            </div>

            <div className="password-panel">
              <div className="password-title">
                ENTER PASSWORD
              </div>

              <div className="password-hint">
                <span>HINT</span>

                <p>
                  {doorHint}
                </p>
              </div>

              <input
                className="password-input"
                type="text"
                value={password}
                maxLength={
                  isFinalDoor
                    ? 4
                    : 20
                }
                disabled={
                  doorState ===
                    "permanent" ||
                  doorState ===
                    "opening"
                }
                onChange={(event) =>
                  setPassword(
                    event.target.value.toUpperCase()
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    openDoor();
                  }
                }}
                placeholder="ENTER CODE"
                autoComplete="off"
              />

              <button
                className="unlock-button"
                disabled={
                  doorState ===
                    "permanent" ||
                  doorState ===
                    "opening"
                }
                onClick={
                  openDoor
                }
              >
                {doorState ===
                "opening"
                  ? "UNLOCKING..."
                  : "UNLOCK"}
              </button>

              <div className="attempt-counter">
                ATTEMPTS REMAINING:{" "}
                <strong>
                  {
                    remainingAttempts
                  }
                </strong>
              </div>

              {error && (
                <motion.div
                  className="door-error"
                  initial={{
                    opacity: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                >
                  {error}
                </motion.div>
              )}
            </div>
          </motion.div>

          <AnimatePresence>
            {doorState ===
              "opening" && (
              <motion.div
                className="unlock-overlay"
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                exit={{
                  opacity: 0,
                }}
              >
                <motion.div
                  className="unlock-text"
                  initial={{
                    scale: 0.6,
                    opacity: 0,
                  }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                  }}
                >
                  ACCESS GRANTED
                </motion.div>

                <div className="unlock-subtext">
                  {isFinalDoor
                    ? "FINAL EXIT OPENING"
                    : "NEXT LOCK UNLOCKED"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <FullscreenOverlay />
      </>
    );
  }

  /* =========================================================
     FINAL
  ========================================================= */

  if (screen === "final") {
    return (
      <>
        <div className="app final-screen">
          <div className="final-sky" />

          <motion.div
            className="final-sun"
            initial={{
              scale: 0,
            }}
            animate={{
              scale: 1,
            }}
            transition={{
              duration: 2,
              ease: "easeOut",
            }}
          />

          <div className="final-ocean">
            <div className="wave wave-one" />
            <div className="wave wave-two" />
            <div className="wave wave-three" />
          </div>

          <div className="final-sand" />

          <motion.div
            className="final-content"
            initial={{
              opacity: 0,
              y: 50,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              delay: 1.5,
              duration: 1.5,
            }}
          >
            <div className="final-lock">
              {finalMessage}
            </div>

            <h1>
              YOU ESCAPED
            </h1>

            <div className="final-divider" />

            <h2>
              YOU'RE SAFE.
            </h2>

            <h3>
              CONGRATULATIONS!
            </h3>

            <p>
              THE ESCAPE PROTOCOL HAS
              BEEN COMPLETED.
            </p>
          </motion.div>
        </div>

        <FullscreenOverlay />
      </>
    );
  }

  return null;
}

export default App;