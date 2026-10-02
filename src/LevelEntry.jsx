import { motion } from "framer-motion";

export default function LevelEntry({ level, onEnter }) {
  const levelNumber = String(level).padStart(2, "0");

  const levelData = {
    1: {
      title: "THE LOGIC VAULT",
      subtitle: "TECHNICAL INTELLIGENCE",
      classification: "LOGIC // ANALYSIS // DEDUCTION",
      node: "SECURITY NODE // 01",
    },

    2: {
      title: "THE CODE CHAMBER",
      subtitle: "CODE RECONSTRUCTION",
      classification: "CODE // SEQUENCE // EXECUTION",
      node: "SECURITY NODE // 02",
    },

    3: {
      title: "THE PATTERN VAULT",
      subtitle: "REGEX INTELLIGENCE",
      classification: "PATTERN // SYNTAX // RECOGNITION",
      node: "SECURITY NODE // 03",
    },

    4: {
      title: "THE BREACH ROOM",
      subtitle: "DEBUG & DECODE",
      classification: "DEBUG // TRACE // OVERRIDE",
      node: "SECURITY NODE // 04",
    },

    5: {
      title: "THE FINAL LOCK",
      subtitle: "ULTIMATE CHALLENGE",
      classification: "FINAL // ESCAPE // FREEDOM",
      node: "SECURITY NODE // 05",
    },
  };

  const currentLevel =
    levelData[level] || levelData[1];

  return (
    <motion.main
      className="level-entry"
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      transition={{
        duration: 0.8,
      }}
    >
      {/* BACKGROUND */}
      <div className="entry-background-grid" />
      <div className="entry-background-glow" />
      <div className="entry-vignette" />
      <div className="entry-noise" />

      {/* SYSTEM HEADER */}
      <motion.header
        className="entry-system-header"
        initial={{
          opacity: 0,
          y: -20,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.6,
        }}
      >
        <div className="system-brand">
          <span className="system-dot" />

          <span>
            ESCAPE PROTOCOL
          </span>
        </div>

        <div className="system-node">
          {currentLevel.node}
        </div>
      </motion.header>

      {/* MAIN ENTRY PANEL */}
      <motion.section
        className="entry-panel"
        initial={{
          opacity: 0,
          scale: 0.94,
          y: 25,
        }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
        }}
        transition={{
          duration: 0.8,
          delay: 0.15,
        }}
      >
        {/* SECURITY ALERT */}
        <motion.div
          className="entry-security-alert"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: [0, 1, 0.45, 1],
          }}
          transition={{
            duration: 1.5,
            delay: 0.4,
          }}
        >
          <span className="alert-symbol">
            ⚠
          </span>

          SECURITY BREACH DETECTED
        </motion.div>

        {/* SEPARATOR */}
        <motion.div
          className="entry-separator"
          initial={{
            scaleX: 0,
          }}
          animate={{
            scaleX: 1,
          }}
          transition={{
            duration: 0.8,
            delay: 0.55,
          }}
        >
          <span />
        </motion.div>

        {/* LOCK NUMBER */}
        <motion.div
          className="entry-lock-label"
          initial={{
            opacity: 0,
            letterSpacing: "0.7em",
          }}
          animate={{
            opacity: 1,
            letterSpacing: "0.35em",
          }}
          transition={{
            duration: 0.8,
            delay: 0.65,
          }}
        >
          LOCK {levelNumber}
        </motion.div>

        {/* LEVEL NUMBER */}
        <motion.div
          className="entry-level-number"
          initial={{
            opacity: 0,
            scale: 1.3,
            filter: "blur(12px)",
          }}
          animate={{
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
          }}
          transition={{
            duration: 0.9,
            delay: 0.75,
          }}
        >
          LEVEL {levelNumber}
        </motion.div>

        {/* TITLE */}
        <motion.h1
          className="entry-title"
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.7,
            delay: 0.95,
          }}
        >
          {currentLevel.title}
        </motion.h1>

        {/* SUBTITLE */}
        <motion.h2
          className="entry-subtitle"
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.6,
            delay: 1.1,
          }}
        >
          {currentLevel.subtitle}
        </motion.h2>

        {/* CLASSIFICATION */}
        <motion.div
          className="entry-classification"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 0.6,
            delay: 1.2,
          }}
        >
          {currentLevel.classification}
        </motion.div>

        {/* ACCESS */}
        <motion.div
          className="entry-access"
          initial={{
            opacity: 0,
            scale: 0.9,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            duration: 0.6,
            delay: 1.3,
          }}
        >
          <span className="access-indicator" />

          <span>
            ACCESS GRANTED
          </span>
        </motion.div>

        {/* ENTER BUTTON */}
        <motion.button
          type="button"
          className="entry-enter-button"
          onClick={onEnter}
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.7,
            delay: 1.45,
          }}
          whileHover={{
            scale: 1.035,
          }}
          whileTap={{
            scale: 0.96,
          }}
        >
          <span className="button-bracket">
            [
          </span>

          <span>
            ENTER LEVEL {levelNumber}
          </span>

          <span className="button-bracket">
            ]
          </span>
        </motion.button>

        {/* SYSTEM STATUS */}
        <motion.div
          className="entry-system-status"
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 0.7,
            delay: 1.6,
          }}
        >
          <span>
            SECURE CONNECTION
          </span>

          <span className="status-divider">
            ///
          </span>

          <span>
            NO EXIT DETECTED
          </span>
        </motion.div>
      </motion.section>

      {/* CORNER DETAILS */}
      <div className="entry-corner entry-corner-tl">
        <span />
      </div>

      <div className="entry-corner entry-corner-tr">
        <span />
      </div>

      <div className="entry-corner entry-corner-bl">
        <span />
      </div>

      <div className="entry-corner entry-corner-br">
        <span />
      </div>

      {/* SCANLINE */}
      <motion.div
        className="entry-scanline"
        animate={{
          y: ["-100vh", "100vh"],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* SIDE DATA */}
      <div className="entry-side-data entry-side-left">
        <span>SYS</span>
        <span>SEC</span>
        <span>NODE</span>
        <span>ACTIVE</span>
      </div>

      <div className="entry-side-data entry-side-right">
        <span>01</span>
        <span>10</span>
        <span>01</span>
        <span>01</span>
      </div>

      {/* BOTTOM SYSTEM CODE */}
      <div className="entry-bottom-code">
        EP // CSI // AUTHORIZED PARTICIPANT ACCESS
      </div>
    </motion.main>
  );
}