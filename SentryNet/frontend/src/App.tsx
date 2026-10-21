import { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  Shield,
  Video,
  Upload,
  LogOut,
  ArrowLeft,
  Play,
  Trash2,
  Activity,
  MapPin,
  Clock,
  Film,
} from "lucide-react";
import { loginUser, registerUser } from "./services/authService";
import "./App.css";

interface CurrentUser {
  id: number;
  displayName: string;
  email: string;
}

interface VideoMetadata {
  duration: string;
  resolution: string;
  frameRate: string;
}

interface AiAlert {
  type?: string;
  severity?: string;
  frame?: number;
  description?: string;
}

interface AiAnalysisResponse {
  project?: string;
  video_id?: string;
  original_filename?: string;
  status?: string;
  frames_processed?: number;
  max_people_in_frame?: number;
  total_person_detections_across_frames?: number;
  alerts?: AiAlert[];
  analyzed_video?: string;
  note?: string;
  detail?: string;
}

function getSavedUser(): CurrentUser | null {
  try {
    const saved = localStorage.getItem("sentrynet_user");
    return saved ? (JSON.parse(saved) as CurrentUser) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(
    getSavedUser
  );

  const [isRegister, setIsRegister] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [activePage, setActivePage] = useState<"videos" | "upload">("videos");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showVideoDetail, setShowVideoDetail] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] =
    useState<AiAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState("");

  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata>({
    duration: "--",
    resolution: "--",
    frameRate: "--",
  });

  const [videoUrl, setVideoUrl] = useState("");

  // Create and clean up the local video preview URL.
  useEffect(() => {
    if (!selectedFile) {
      setVideoUrl("");
      setVideoMetadata({
        duration: "--",
        resolution: "--",
        frameRate: "--",
      });
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    const video = document.createElement("video");

    setVideoUrl(url);
    video.preload = "metadata";
    video.src = url;

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration)
        ? `${Math.round(video.duration)}s`
        : "Unavailable";

      setVideoMetadata({
        duration,
        resolution: `${video.videoWidth} × ${video.videoHeight}`,
        frameRate: "Requires ffprobe",
      });
    };

    video.onerror = () => {
      setVideoMetadata({
        duration: "Unavailable",
        resolution: "Unavailable",
        frameRate: "Requires ffprobe",
      });
    };

    return () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      if (isRegister) {
        await registerUser({ displayName, email, password });
        setIsRegister(false);
        setPassword("");
        setMessage("Account created successfully! Please sign in.");
      } else {
        const user = await loginUser({ email, password });

        const signedInUser: CurrentUser = {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
        };

        localStorage.setItem("sentrynet_token", user.token);
        localStorage.setItem(
          "sentrynet_user",
          JSON.stringify(signedInUser)
        );

        setCurrentUser(signedInUser);
        setActivePage("videos");
        setShowVideoDetail(false);
        setMessage("");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("sentrynet_token");
    localStorage.removeItem("sentrynet_user");

    setCurrentUser(null);
    setActivePage("videos");
    setShowVideoDetail(false);
    setIsRegister(false);
    setPassword("");
    setMessage("");
    setSelectedFile(null);
    setAnalysisHistory([]);
    setAnalysisResult(null);
    setAnalysisError("");
    setIsAnalyzing(false);
  }

  // Send the selected video to the Python AI service.
  async function handleAnalyzeVideo() {
    if (!selectedFile) {
      setAnalysisError("Please select a video before starting analysis.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/analyze-video",
        {
          method: "POST",
          body: formData,
        }
      );

      const result =
        (await response.json()) as AiAnalysisResponse;

      if (!response.ok) {
        throw new Error(
          result.detail ||
            `AI service returned HTTP ${response.status}`
        );
      }

      setAnalysisResult(result);

      setAnalysisHistory((history) => [
        `Analysis completed · ${new Date().toLocaleString()}`,
        ...history,
      ]);
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? `${error.message}. Check that the Python AI service is running at http://127.0.0.1:8000.`
          : "Could not connect to the AI analysis service."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleDeleteVideo() {
    if (!selectedFile) return;

    const confirmed = window.confirm(
      `Delete "${selectedFile.name}" from this current session?`
    );

    if (!confirmed) return;

    setSelectedFile(null);
    setShowVideoDetail(false);
    setActivePage("videos");
    setAnalysisHistory([]);
    setAnalysisResult(null);
    setAnalysisError("");
    setIsAnalyzing(false);
    setMessage("The selected local video was cleared.");
  }

  return (
    <main className={`auth-app ${darkMode ? "dark" : "light"}`}>
      <header className="topbar">
        <div className="brand">
          <Shield size={17} />
          <span>SENTRY-NET</span>
        </div>

        {currentUser ? (
          <nav className="main-nav">
            <button
              className={
                activePage === "videos" && !showVideoDetail
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => {
                setActivePage("videos");
                setShowVideoDetail(false);
                setMessage("");
              }}
              type="button"
            >
              Videos
            </button>

            <button
              className={
                activePage === "upload" && !showVideoDetail
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => {
                setActivePage("upload");
                setShowVideoDetail(false);
                setMessage("");
              }}
              type="button"
            >
              Upload
            </button>

            <span className="nav-username">
              {currentUser.displayName}
            </span>

            <button
              className="nav-button logout-button"
              onClick={handleLogout}
              type="button"
            >
              <LogOut size={14} />
              Log out
            </button>

            <button
              className="theme-button"
              type="button"
              aria-label="Toggle theme"
              onClick={() => setDarkMode((previous) => !previous)}
            >
              {darkMode ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}
            </button>
          </nav>
        ) : (
          <button
            className="theme-button"
            type="button"
            aria-label="Toggle theme"
            onClick={() => setDarkMode((previous) => !previous)}
          >
            {darkMode ? (
              <Sun size={17} />
            ) : (
              <Moon size={17} />
            )}
          </button>
        )}
      </header>

      {!currentUser ? (
        <section className="auth-stage">
          <div className="auth-card">
            <h1>
              {isRegister
                ? "Create your account"
                : "Sign in to SENTRY-NET"}
            </h1>

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <label className="field">
                  <span>Display name</span>
                  <input
                    type="text"
                    placeholder="Your name"
                    value={displayName}
                    onChange={(event) =>
                      setDisplayName(event.target.value)
                    }
                    autoComplete="name"
                    required
                  />
                </label>
              )}

              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  autoComplete="email"
                  required
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  minLength={isRegister ? 10 : undefined}
                  required
                />
              </label>

              {isRegister && (
                <p className="password-hint">
                  At least 10 characters
                </p>
              )}

              <button
                className="submit-button"
                type="submit"
                disabled={isLoading}
              >
                {isLoading
                  ? "PLEASE WAIT..."
                  : isRegister
                    ? "REGISTER"
                    : "SIGN IN"}
              </button>
            </form>

            {message && (
              <p className="switch-auth" role="status">
                {message}
              </p>
            )}

            <p className="switch-auth">
              {isRegister
                ? "Already have an account?"
                : "No account yet?"}{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setIsRegister((previous) => !previous);
                  setPassword("");
                  setMessage("");
                }}
              >
                {isRegister ? "Sign in" : "Register"}
              </button>
            </p>
          </div>
        </section>
      ) : (
        <section className="dashboard">
          {showVideoDetail ? (
            <div className="video-detail">
              <div className="page-heading">
                <div>
                  <button
                    className="back-link"
                    type="button"
                    onClick={() => {
                      setShowVideoDetail(false);
                      setActivePage("videos");
                    }}
                  >
                    <ArrowLeft size={15} />
                    Back to Videos
                  </button>

                  <h1>Video Detail</h1>
                  <p>{selectedFile?.name ?? "Selected video"}</p>
                </div>
              </div>

              {selectedFile ? (
                <div className="video-detail-layout">
                  <div className="video-detail-main">
                    <div className="detail-panel video-player-panel">
                      <div className="panel-title">
                        <Play size={17} />
                        <h2>Video Preview</h2>
                      </div>

                      <video
                        className="detail-video-player"
                        controls
                        preload="metadata"
                        src={videoUrl || undefined}
                      >
                        Your browser does not support video playback.
                      </video>
                    </div>

                    <div className="metadata-grid">
                      <div className="metadata-card">
                        <Clock size={17} />
                        <span>Duration</span>
                        <strong>{videoMetadata.duration}</strong>
                      </div>

                      <div className="metadata-card">
                        <Film size={17} />
                        <span>Resolution</span>
                        <strong>{videoMetadata.resolution}</strong>
                      </div>

                      <div className="metadata-card">
                        <Activity size={17} />
                        <span>Frame Rate</span>
                        <strong>{videoMetadata.frameRate}</strong>
                      </div>
                    </div>

                    <div className="detail-panel">
                      <div className="panel-title">
                        <Activity size={17} />
                        <h2>Analysis History</h2>
                      </div>

                      {analysisHistory.length === 0 ? (
                        <p className="muted-text">
                          No analysis runs yet. Select Analyze Video
                          to start.
                        </p>
                      ) : (
                        <ul className="analysis-history-list">
                          {analysisHistory.map((item, index) => (
                            <li key={`${item}-${index}`}>
                              <span className="history-dot" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <details className="detail-panel restricted-zones">
                      <summary>
                        <MapPin size={17} />
                        <span>Restricted Zones</span>
                        <span className="zone-count">0</span>
                      </summary>

                      <p className="muted-text">
                        No restricted zones have been drawn for this
                        video. Zone drawing and intrusion detection
                        are not connected yet.
                      </p>
                    </details>
                  </div>

                  <aside className="video-detail-actions">
                    <div className="detail-panel action-panel">
                      <h2>Actions</h2>

                      <button
                        className="submit-button analyze-video-button"
                        type="button"
                        onClick={handleAnalyzeVideo}
                        disabled={isAnalyzing}
                      >
                        <Activity size={16} />
                        {isAnalyzing
                          ? "Analyzing video..."
                          : "Analyze Video"}
                      </button>

                      <p className="muted-text action-help">
                        {isAnalyzing
                          ? "The AI service is processing your uploaded video. Please wait."
                          : "Send this prerecorded video to the AI analysis service."}
                      </p>

                      {isAnalyzing && (
                        <div
                          className="analysis-inline-status"
                          role="status"
                        >
                          Processing video with SENTRY-NET AI.
                          This may take a few minutes.
                        </div>
                      )}

                      {analysisError && (
                        <div
                          className="analysis-inline-error"
                          role="alert"
                        >
                          {analysisError}
                        </div>
                      )}

                      {analysisResult && (
                        <section
                          className="actual-analysis-results"
                          aria-live="polite"
                        >
                          <h2>AI Analysis Results</h2>

                          <p className="muted-text">
                            Status:{" "}
                            <strong>
                              {analysisResult.status ||
                                "Response received"}
                            </strong>
                          </p>

                          <div className="analysis-summary-grid">
                            <div className="analysis-summary-card">
                              <span>Frames processed</span>
                              <strong>
                                {analysisResult.frames_processed ?? "—"}
                              </strong>
                            </div>

                            <div className="analysis-summary-card">
                              <span>Max people in one frame</span>
                              <strong>
                                {analysisResult.max_people_in_frame ?? "—"}
                              </strong>
                            </div>

                            <div className="analysis-summary-card">
                              <span>Person detections</span>
                              <strong>
                                {analysisResult.total_person_detections_across_frames ??
                                  "—"}
                              </strong>
                            </div>
                          </div>

                          <h3>Detected alerts</h3>

                          {!analysisResult.alerts ||
                          analysisResult.alerts.length === 0 ? (
                            <p className="muted-text">
                              The AI service returned no alerts for
                              this video.
                            </p>
                          ) : (
                            <div className="event-results-list">
                              {analysisResult.alerts.map(
                                (alert, index) => (
                                  <article
                                    className="event-result-card"
                                    key={`${alert.type || "alert"}-${index}`}
                                  >
                                    <div className="event-result-title">
                                      <h3>
                                        {alert.type || "Alert"}
                                      </h3>

                                      <span
                                        className={`threat-badge threat-${(
                                          alert.severity || "medium"
                                        ).toLowerCase()}`}
                                      >
                                        {alert.severity ||
                                          "UNSPECIFIED"}
                                      </span>
                                    </div>

                                    <p>
                                      {alert.description ||
                                        "No description was returned."}
                                    </p>

                                    {typeof alert.frame === "number" && (
                                      <p className="muted-text">
                                        Frame: {alert.frame}
                                      </p>
                                    )}
                                  </article>
                                )
                              )}
                            </div>
                          )}

                          {analysisResult.note && (
                            <p className="analysis-notice">
                              {analysisResult.note}
                            </p>
                          )}

                          {analysisResult.analyzed_video && (
                            <p>
                              <a
                                href={`http://127.0.0.1:8000${analysisResult.analyzed_video}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open analyzed video
                              </a>
                            </p>
                          )}

                          <p className="muted-text">
                            This display shows only fields returned by
                            the current AI service. It does not invent
                            shoplifting labels, timestamps, or person
                            tracking IDs.
                          </p>
                        </section>
                      )}

                      <div className="action-divider" />

                      <button
                        className="delete-video-button"
                        type="button"
                        onClick={handleDeleteVideo}
                      >
                        <Trash2 size={16} />
                        Delete Video
                      </button>

                      <p className="muted-text action-help">
                        Clear this selected video from the current
                        session.
                      </p>
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="empty-videos">
                  <Video size={42} />
                  <h2>No video selected</h2>

                  <button
                    className="submit-button"
                    type="button"
                    onClick={() => {
                      setShowVideoDetail(false);
                      setActivePage("upload");
                    }}
                  >
                    <Upload size={16} />
                    Select a Video
                  </button>
                </div>
              )}
            </div>
          ) : activePage === "videos" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>Your Videos</h1>
                  <p>Manage and review your uploaded videos.</p>
                </div>

                <button
                  className="submit-button upload-cta"
                  type="button"
                  onClick={() => {
                    setActivePage("upload");
                    setMessage("");
                  }}
                >
                  <Upload size={16} />
                  Upload Video
                </button>
              </div>

              {selectedFile ? (
                <div className="video-list-card">
                  <div className="video-list-icon">
                    <Video size={24} />
                  </div>

                  <div className="video-list-info">
                    <strong>{selectedFile.name}</strong>
                    <span>
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>

                  <button
                    className="nav-button"
                    type="button"
                    onClick={() => setShowVideoDetail(true)}
                  >
                    View Details
                  </button>
                </div>
              ) : (
                <div className="empty-videos">
                  <Video size={42} strokeWidth={1.4} />
                  <h2>No videos yet</h2>
                  <p>Upload a video to get started.</p>

                  <button
                    className="submit-button upload-cta"
                    type="button"
                    onClick={() => {
                      setActivePage("upload");
                      setMessage("");
                    }}
                  >
                    <Upload size={16} />
                    Upload Video
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="upload-panel">
              <h1>Upload Video</h1>
              <p>Select a prerecorded video from your computer.</p>

              <label className="video-dropzone">
                <Upload size={32} />

                <strong>
                  {selectedFile
                    ? selectedFile.name
                    : "Choose a video file"}
                </strong>

                <span>Supported formats: MP4, AVI, MOV, WebM</span>

                <input
                  type="file"
                  accept=".mp4,.avi,.mov,.webm,video/mp4,video/avi,video/quicktime,video/webm"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;

                    setSelectedFile(file);
                    setAnalysisHistory([]);
                    setAnalysisResult(null);
                    setAnalysisError("");
                    setMessage("");
                  }}
                />
              </label>

              {selectedFile && (
                <div className="selected-file-info">
                  <span>Selected file</span>
                  <strong>{selectedFile.name}</strong>
                  <span>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              )}

              <p className="upload-note">
                The selected video is previewed locally. When you
                choose Analyze Video, it will be sent to the running
                SENTRY-NET AI service for processing.
              </p>

              <button
                className="submit-button upload-cta"
                type="button"
                disabled={!selectedFile}
                onClick={() => {
                  if (!selectedFile) return;

                  setShowVideoDetail(true);
                  setAnalysisHistory([]);
                  setAnalysisResult(null);
                  setAnalysisError("");
                  setMessage("");
                }}
              >
                <Play size={16} />
                Continue to Video Detail
              </button>

              {message && (
                <p className="switch-auth" role="status">
                  {message}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}