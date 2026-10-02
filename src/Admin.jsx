import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import "./Admin.css";

const LEVELS = [
  {
    id: 1,
    number: 1,
    name: "THE LOGIC VAULT",
    subtitle: "TECHNICAL INTELLIGENCE",
  },
  {
    id: 2,
    number: 2,
    name: "THE CODE CHAMBER",
    subtitle: "JUMBLED CODE",
  },
  {
    id: 3,
    number: 3,
    name: "THE PATTERN VAULT",
    subtitle: "REGEX INTELLIGENCE",
  },
  {
    id: 4,
    number: 4,
    name: "THE BREACH ROOM",
    subtitle: "DEBUG & DECODE",
  },
  {
    id: 5,
    number: 5,
    name: "THE FINAL LOCK",
    subtitle: "ULTIMATE CHALLENGE",
  },
];

const formatTime = (seconds) => {
  const value = Number(seconds) || 0;

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}`;
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getStatusClass = (status) => {
  switch (status) {
    case "completed":
      return "status-completed";

    case "active":
    case "in_progress":
      return "status-active";

    case "locked":
    case "door_locked":
      return "status-locked";

    case "qualified":
      return "status-qualified";

    case "not_qualified":
      return "status-not-qualified";

    default:
      return "status-registered";
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case "completed":
      return "COMPLETED";

    case "active":
    case "in_progress":
      return "ACTIVE";

    case "locked":
    case "door_locked":
      return "LOCKED";

    case "qualified":
      return "QUALIFIED";

    case "not_qualified":
      return "NOT QUALIFIED";

    case "registered":
      return "REGISTERED";

    default:
      return String(status || "UNKNOWN").replaceAll("_", " ").toUpperCase();
  }
};

const getSecurityCount = (events, participantId, eventType) => {
  return events.filter(
    (event) =>
      event.participant_id === participantId &&
      event.event_type === eventType
  ).length;
};

const getLevelStatus = (participant, levelId) => {
  const result = participant.levelResults.find(
    (item) => Number(item.level_id) === Number(levelId)
  );

  if (!result) return "locked";

  if (result.status === "completed") return "completed";

  if (result.status === "door_locked") return "locked";

  if (result.status === "in_progress") return "active";

  return "registered";
};

const buildParticipant = (
  participant,
  levelResults,
  doorAttempts,
  activityEvents
) => {
  const results = levelResults.filter(
    (item) => item.participant_id === participant.id
  );

  const doors = doorAttempts.filter(
    (item) => item.participant_id === participant.id
  );

  const events = activityEvents.filter(
    (item) => item.participant_id === participant.id
  );

  const totalScore = results.reduce(
    (sum, item) => sum + (Number(item.score) || 0),
    0
  );

  const totalTime = results.reduce(
    (sum, item) => sum + (Number(item.time_seconds) || 0),
    0
  );

  const completedLevels = results.filter(
    (item) => item.status === "completed"
  ).length;

  const passwordAttempts = doors.length;

  const successfulDoors = doors.filter((item) => item.success).length;

  const tabSwitches = events.filter(
    (event) =>
      event.event_type === "tab_switch" ||
      event.event_type === "visibility_hidden" ||
      event.event_type === "tab_hidden"
  ).length;

  const fullscreenExits = events.filter(
    (event) =>
      event.event_type === "fullscreen_exit" ||
      event.event_type === "fullscreen_exited"
  ).length;

  const securityEvents = events.filter((event) => {
    const type = String(event.event_type || "").toLowerCase();

    return (
      type.includes("tab") ||
      type.includes("fullscreen") ||
      type.includes("security") ||
      type.includes("violation")
    );
  }).length;

  let calculatedStatus = participant.status;

  if (participant.status === "registered" && participant.started_at) {
    calculatedStatus = "active";
  }

  if (participant.completed_at) {
    calculatedStatus = "completed";
  }

  const lockedLevel = results.find((item) => item.status === "door_locked");

  if (lockedLevel && !participant.completed_at) {
    calculatedStatus = "locked";
  }

  return {
    ...participant,
    levelResults: results,
    doorAttempts: doors,
    activityEvents: events,
    totalScore,
    totalTime,
    completedLevels,
    passwordAttempts,
    successfulDoors,
    tabSwitches,
    fullscreenExits,
    securityEvents,
    calculatedStatus,
    lockedLevel,
  };
};

export default function Admin() {
  const [participants, setParticipants] = useState([]);
  const [levelResults, setLevelResults] = useState([]);
  const [doorAttempts, setDoorAttempts] = useState([]);
  const [activityEvents, setActivityEvents] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score");

  const [selectedParticipant, setSelectedParticipant] = useState(null);

  const loadDashboard = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const [
        participantsResponse,
        levelResultsResponse,
        doorAttemptsResponse,
        activityEventsResponse,
      ] = await Promise.all([
        supabase
          .from("participants")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("level_results")
          .select("*")
          .order("level_id", { ascending: true }),

        supabase
          .from("door_attempts")
          .select("*")
          .order("attempted_at", { ascending: false }),

        supabase
          .from("activity_events")
          .select("*")
          .order("occurred_at", { ascending: false }),
      ]);

      if (participantsResponse.error) {
        throw new Error(
          `Participants: ${participantsResponse.error.message}`
        );
      }

      if (levelResultsResponse.error) {
        throw new Error(
          `Level results: ${levelResultsResponse.error.message}`
        );
      }

      if (doorAttemptsResponse.error) {
        throw new Error(
          `Door attempts: ${doorAttemptsResponse.error.message}`
        );
      }

      if (activityEventsResponse.error) {
        throw new Error(
          `Activity events: ${activityEventsResponse.error.message}`
        );
      }

      setParticipants(participantsResponse.data || []);
      setLevelResults(levelResultsResponse.data || []);
      setDoorAttempts(doorAttemptsResponse.data || []);
      setActivityEvents(activityEventsResponse.data || []);
    } catch (err) {
      console.error("ADMIN DASHBOARD ERROR:", err);

      setError(
        err?.message ||
          "Unable to load admin dashboard data. Check Supabase connection and policies."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);

    const interval = setInterval(() => {
      loadDashboard(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  const adminParticipants = useMemo(() => {
    return participants.map((participant) =>
      buildParticipant(
        participant,
        levelResults,
        doorAttempts,
        activityEvents
      )
    );
  }, [participants, levelResults, doorAttempts, activityEvents]);

  const statistics = useMemo(() => {
    const total = adminParticipants.length;

    const active = adminParticipants.filter(
      (participant) => participant.calculatedStatus === "active"
    ).length;

    const completed = adminParticipants.filter(
      (participant) => participant.calculatedStatus === "completed"
    ).length;

    const locked = adminParticipants.filter(
      (participant) => participant.calculatedStatus === "locked"
    ).length;

    const totalScore = adminParticipants.reduce(
      (sum, participant) => sum + participant.totalScore,
      0
    );

    const averageScore = total > 0 ? totalScore / total : 0;

    const securityEvents = activityEvents.filter((event) => {
      const type = String(event.event_type || "").toLowerCase();

      return (
        type.includes("tab") ||
        type.includes("fullscreen") ||
        type.includes("security") ||
        type.includes("violation")
      );
    }).length;

    return {
      total,
      active,
      completed,
      locked,
      averageScore,
      securityEvents,
    };
  }, [adminParticipants, activityEvents]);

  const filteredParticipants = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = adminParticipants.filter((participant) => {
      const matchesSearch =
        !query ||
        String(participant.name || "")
          .toLowerCase()
          .includes(query) ||
        String(participant.roll_number || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        participant.calculatedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });

    result = [...result].sort((a, b) => {
      if (sortBy === "score") {
        return b.totalScore - a.totalScore;
      }

      if (sortBy === "time") {
        return a.totalTime - b.totalTime;
      }

      if (sortBy === "levels") {
        return b.completedLevels - a.completedLevels;
      }

      if (sortBy === "security") {
        return b.securityEvents - a.securityEvents;
      }

      if (sortBy === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }

      return 0;
    });

    return result;
  }, [adminParticipants, search, statusFilter, sortBy]);

  const exportCSV = () => {
    const headers = [
      "Name",
      "Roll Number",
      "Status",
      "Score",
      "Levels Completed",
      "Total Time",
      "Password Attempts",
      "Successful Doors",
      "Tab Switches",
      "Fullscreen Exits",
      "Security Events",
      "Started At",
      "Completed At",
    ];

    const rows = filteredParticipants.map((participant) => [
      participant.name,
      participant.roll_number,
      getStatusLabel(participant.calculatedStatus),
      participant.totalScore,
      `${participant.completedLevels}/5`,
      formatTime(participant.totalTime),
      participant.passwordAttempts,
      participant.successfulDoors,
      participant.tabSwitches,
      participant.fullscreenExits,
      participant.securityEvents,
      participant.started_at || "",
      participant.completed_at || "",
    ]);

    const escapeCSV = (value) => {
      const stringValue = String(value ?? "");

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replaceAll('"', '""')}"`;
      }

      return stringValue;
    };

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `escape-protocol-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const inspectParticipant = (participant) => {
    setSelectedParticipant(participant);
  };

  const closeModal = () => {
    setSelectedParticipant(null);
  };

  if (loading) {
    return (
      <div className="admin-page admin-loading-page">
        <div className="admin-loader">
          <div className="loader-ring" />
          <div className="loader-title">ESCAPE PROTOCOL</div>
          <div className="loader-subtitle">INITIALIZING CONTROL CENTER</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-grid-bg" />

      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-brand-mark">
            EP
          </div>

          <div>
            <div className="admin-eyebrow">
              CSI // ESCAPE PROTOCOL
            </div>

            <h1>ADMIN CONTROL CENTER</h1>

            <p>
              Five Locks. One Escape. // Mission Monitoring Interface
            </p>
          </div>
        </div>

        <div className="admin-header-actions">
          <div className="live-indicator">
            <span className="live-dot" />
            LIVE MONITORING
          </div>

          <button
            className="admin-button secondary"
            onClick={() => loadDashboard(false)}
            disabled={refreshing}
          >
            <span className={refreshing ? "spin" : ""}>↻</span>
            {refreshing ? "REFRESHING..." : "REFRESH"}
          </button>

          <button
            className="admin-button primary"
            onClick={exportCSV}
            disabled={filteredParticipants.length === 0}
          >
            ↓ EXPORT CSV
          </button>
        </div>
      </header>

      {error && (
        <div className="admin-error">
          <div className="error-icon">!</div>

          <div>
            <strong>DATABASE CONNECTION ERROR</strong>
            <p>{error}</p>
          </div>

          <button onClick={() => loadDashboard(true)}>RETRY</button>
        </div>
      )}

      <main className="admin-content">
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-top">
              <span className="stat-label">TOTAL PARTICIPANTS</span>
              <span className="stat-symbol">◈</span>
            </div>

            <div className="stat-value">{statistics.total}</div>

            <div className="stat-footer">
              REGISTERED MISSIONS
            </div>
          </div>

          <div className="stat-card active-card">
            <div className="stat-card-top">
              <span className="stat-label">ACTIVE</span>
              <span className="stat-symbol">●</span>
            </div>

            <div className="stat-value">{statistics.active}</div>

            <div className="stat-footer">
              CURRENTLY INSIDE
            </div>
          </div>

          <div className="stat-card completed-card">
            <div className="stat-card-top">
              <span className="stat-label">COMPLETED</span>
              <span className="stat-symbol">✓</span>
            </div>

            <div className="stat-value">{statistics.completed}</div>

            <div className="stat-footer">
              FIVE LOCKS CLEARED
            </div>
          </div>

          <div className="stat-card locked-card">
            <div className="stat-card-top">
              <span className="stat-label">LOCKED</span>
              <span className="stat-symbol">⌁</span>
            </div>

            <div className="stat-value">{statistics.locked}</div>

            <div className="stat-footer">
              ACCESS TERMINATED
            </div>
          </div>

          <div className="stat-card score-card">
            <div className="stat-card-top">
              <span className="stat-label">AVG SCORE</span>
              <span className="stat-symbol">◆</span>
            </div>

            <div className="stat-value">
              {statistics.averageScore.toFixed(1)}
            </div>

            <div className="stat-footer">
              OUT OF 500
            </div>
          </div>

          <div className="stat-card security-card">
            <div className="stat-card-top">
              <span className="stat-label">SECURITY EVENTS</span>
              <span className="stat-symbol">!</span>
            </div>

            <div className="stat-value">
              {statistics.securityEvents}
            </div>

            <div className="stat-footer">
              TAB / FULLSCREEN EVENTS
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-kicker">
                // PARTICIPANT DATABASE
              </div>

              <h2>MISSION OPERATIVES</h2>
            </div>

            <div className="participant-count">
              SHOWING{" "}
              <strong>{filteredParticipants.length}</strong>{" "}
              OF <strong>{adminParticipants.length}</strong>
            </div>
          </div>

          <div className="toolbar">
            <div className="search-box">
              <span>⌕</span>

              <input
                type="text"
                placeholder="SEARCH NAME OR ROLL NUMBER..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="toolbar-select">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">ALL STATUS</option>
                <option value="registered">REGISTERED</option>
                <option value="active">ACTIVE</option>
                <option value="completed">COMPLETED</option>
                <option value="locked">LOCKED</option>
              </select>
            </div>

            <div className="toolbar-select">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="score">SORT: SCORE</option>
                <option value="levels">SORT: LEVELS</option>
                <option value="time">SORT: TIME</option>
                <option value="security">SORT: SECURITY</option>
                <option value="name">SORT: NAME</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="participants-table">
              <thead>
                <tr>
                  <th>OPERATIVE</th>
                  <th>STATUS</th>
                  <th>SCORE</th>
                  <th>LEVELS</th>
                  <th>TOTAL TIME</th>
                  <th>SECURITY</th>
                  <th>ACCESS</th>
                </tr>
              </thead>

              <tbody>
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      <div className="empty-icon">⌁</div>
                      <strong>NO OPERATIVES FOUND</strong>
                      <span>
                        Adjust your search or filter parameters.
                      </span>
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((participant) => (
                    <tr key={participant.id}>
                      <td>
                        <div className="operative-cell">
                          <div className="operative-avatar">
                            {String(participant.name || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <div className="operative-name">
                              {participant.name || "UNKNOWN"}
                            </div>

                            <div className="operative-roll">
                              {participant.roll_number}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            participant.calculatedStatus
                          )}`}
                        >
                          <span className="status-dot" />
                          {getStatusLabel(
                            participant.calculatedStatus
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="score-cell">
                          <strong>{participant.totalScore}</strong>
                          <span>/500</span>
                        </div>
                      </td>

                      <td>
                        <div className="level-dots">
                          {LEVELS.map((level) => {
                            const levelStatus = getLevelStatus(
                              participant,
                              level.id
                            );

                            return (
                              <span
                                key={level.id}
                                className={`level-dot ${levelStatus}`}
                                title={`${level.name}: ${levelStatus}`}
                              >
                                {level.number}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td>
                        <span className="time-value">
                          {formatTime(participant.totalTime)}
                        </span>
                      </td>

                      <td>
                        <div className="security-cell">
                          <span
                            className={
                              participant.tabSwitches > 0
                                ? "security-warning"
                                : ""
                            }
                          >
                            T {participant.tabSwitches}
                          </span>

                          <span
                            className={
                              participant.fullscreenExits > 0
                                ? "security-warning"
                                : ""
                            }
                          >
                            F {participant.fullscreenExits}
                          </span>
                        </div>
                      </td>

                      <td>
                        <button
                          className="inspect-button"
                          onClick={() =>
                            inspectParticipant(participant)
                          }
                        >
                          INSPECT
                          <span>→</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="admin-footer">
          <span>
            ESCAPE PROTOCOL // ADMINISTRATIVE TERMINAL
          </span>

          <span>
            AUTO REFRESH: 30 SEC
          </span>
        </footer>
      </main>

      {selectedParticipant && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="participant-modal">
            <div className="modal-header">
              <div>
                <div className="panel-kicker">
                  // OPERATIVE INSPECTION
                </div>

                <h2>{selectedParticipant.name}</h2>

                <div className="modal-roll">
                  {selectedParticipant.roll_number}
                </div>
              </div>

              <button
                className="modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="modal-status-row">
              <span
                className={`status-badge ${getStatusClass(
                  selectedParticipant.calculatedStatus
                )}`}
              >
                <span className="status-dot" />
                {getStatusLabel(
                  selectedParticipant.calculatedStatus
                )}
              </span>

              <span className="modal-id">
                ID: {selectedParticipant.id}
              </span>
            </div>

            <div className="modal-summary-grid">
              <div className="summary-box">
                <span>SCORE</span>
                <strong>
                  {selectedParticipant.totalScore}
                  <small>/500</small>
                </strong>
              </div>

              <div className="summary-box">
                <span>LEVELS</span>
                <strong>
                  {selectedParticipant.completedLevels}
                  <small>/5</small>
                </strong>
              </div>

              <div className="summary-box">
                <span>TIME</span>
                <strong>
                  {formatTime(selectedParticipant.totalTime)}
                </strong>
              </div>

              <div className="summary-box">
                <span>PASSWORDS</span>
                <strong>
                  {selectedParticipant.passwordAttempts}
                </strong>
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">
                LEVEL RESULTS
              </div>

              <div className="level-results">
                {LEVELS.map((level) => {
                  const result =
                    selectedParticipant.levelResults.find(
                      (item) =>
                        Number(item.level_id) === Number(level.id)
                    );

                  return (
                    <div
                      className="level-result-card"
                      key={level.id}
                    >
                      <div className="level-result-number">
                        {level.number}
                      </div>

                      <div className="level-result-info">
                        <strong>{level.name}</strong>
                        <span>{level.subtitle}</span>
                      </div>

                      <div className="level-result-score">
                        {result ? result.score : 0}
                        <small>PTS</small>
                      </div>

                      <div className="level-result-time">
                        {result
                          ? formatTime(result.time_seconds)
                          : "—"}
                      </div>

                      <div
                        className={`mini-status ${
                          result?.status || "locked"
                        }`}
                      >
                        {result?.status === "completed"
                          ? "CLEARED"
                          : result?.status === "door_locked"
                          ? "LOCKED"
                          : result?.status === "in_progress"
                          ? "ACTIVE"
                          : "NOT STARTED"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-columns">
              <div className="modal-section">
                <div className="modal-section-title">
                  SECURITY MONITOR
                </div>

                <div className="security-detail-grid">
                  <div>
                    <span>TAB SWITCHES</span>
                    <strong>
                      {selectedParticipant.tabSwitches}
                    </strong>
                  </div>

                  <div>
                    <span>FULLSCREEN EXITS</span>
                    <strong>
                      {selectedParticipant.fullscreenExits}
                    </strong>
                  </div>

                  <div>
                    <span>SECURITY EVENTS</span>
                    <strong>
                      {selectedParticipant.securityEvents}
                    </strong>
                  </div>

                  <div>
                    <span>DOOR ATTEMPTS</span>
                    <strong>
                      {selectedParticipant.passwordAttempts}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="modal-section">
                <div className="modal-section-title">
                  MISSION TIMELINE
                </div>

                <div className="timeline">
                  <div className="timeline-row">
                    <span>REGISTERED</span>
                    <strong>
                      {formatDate(selectedParticipant.created_at)}
                    </strong>
                  </div>

                  <div className="timeline-row">
                    <span>STARTED</span>
                    <strong>
                      {formatDate(selectedParticipant.started_at)}
                    </strong>
                  </div>

                  <div className="timeline-row">
                    <span>COMPLETED</span>
                    <strong>
                      {formatDate(selectedParticipant.completed_at)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-section-title">
                PASSWORD / DOOR ATTEMPTS
              </div>

              {selectedParticipant.doorAttempts.length === 0 ? (
                <div className="no-events">
                  NO PASSWORD ATTEMPTS RECORDED
                </div>
              ) : (
                <div className="attempt-list">
                  {selectedParticipant.doorAttempts
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.attempted_at) -
                        new Date(a.attempted_at)
                    )
                    .map((attempt) => (
                      <div
                        className="attempt-row"
                        key={attempt.id}
                      >
                        <div>
                          <strong>
                            LEVEL {attempt.level_id}
                          </strong>

                          <span>
                            ATTEMPT #{attempt.attempt_number}
                          </span>
                        </div>

                        <span
                          className={
                            attempt.success
                              ? "attempt-success"
                              : "attempt-failed"
                          }
                        >
                          {attempt.success
                            ? "SUCCESS"
                            : "FAILED"}
                        </span>

                        <span className="attempt-time">
                          {formatDate(attempt.attempted_at)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="modal-section">
              <div className="modal-section-title">
                SECURITY EVENT LOG
              </div>

              {selectedParticipant.activityEvents.length === 0 ? (
                <div className="no-events">
                  NO ACTIVITY EVENTS RECORDED
                </div>
              ) : (
                <div className="event-list">
                  {selectedParticipant.activityEvents
                    .slice(0, 30)
                    .map((event) => (
                      <div
                        className="event-row"
                        key={event.id}
                      >
                        <div className="event-type">
                          {String(
                            event.event_type || "UNKNOWN"
                          )
                            .replaceAll("_", " ")
                            .toUpperCase()}
                        </div>

                        <div className="event-level">
                          {event.level_id
                            ? `LEVEL ${event.level_id}`
                            : "SYSTEM"}
                        </div>

                        <div className="event-time">
                          {formatDate(event.occurred_at)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <span>
                OPERATIVE DATA // ADMIN ONLY
              </span>

              <button
                className="admin-button secondary"
                onClick={closeModal}
              >
                CLOSE INSPECTION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}