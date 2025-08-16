import PropTypes from "prop-types";
import "./Loading.sass"; // Create this file for custom styles

const Loading = ({
  size = "medium",
  message = "Loading...",
  fullScreen = false,
  overlay = false,
  className = "",
  showMessage = true,
  variant = "spinner", // 'spinner', 'dots', 'pulse'
}) => {
  const getSizeRatio = () => {
    switch (size) {
      case "small":
        return 1;
      case "medium":
        return 2;
      case "large":
        return 3;
      case "xlarge":
        return 4;
      default:
        return 2;
    }
  };

  const renderSpinner = () => {
    switch (variant) {
      case "dots":
        return (
          <div className="loading-dots">
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        );
      case "pulse":
        return <div className="loading-pulse"></div>;
      default:
        return <div data-uk-spinner={`ratio: ${getSizeRatio()}`}></div>;
    }
  };

  const loadingContent = (
    <div className={`loading-content uk-text-center ${className}`}>
      <div className="uk-margin-bottom">{renderSpinner()}</div>
      {showMessage && (
        <p
          className={`uk-text-${
            size === "small" ? "small" : "lead"
          } uk-text-muted uk-margin-remove`}
        >
          {message}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-fullscreen uk-position-fixed uk-position-cover uk-flex uk-flex-center uk-flex-middle uk-background-default">
        {overlay && (
          <div className="uk-position-cover uk-overlay-default uk-overlay"></div>
        )}
        <div className="uk-position-z-index">{loadingContent}</div>
      </div>
    );
  }

  if (overlay) {
    return (
      <div className="loading-overlay uk-position-relative">
        <div className="uk-position-cover uk-overlay-default uk-overlay"></div>
        <div className="uk-position-center uk-position-z-index">
          {loadingContent}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-inline uk-flex uk-flex-center uk-flex-middle uk-padding">
      {loadingContent}
    </div>
  );
};

Loading.propTypes = {
  size: PropTypes.oneOf(["small", "medium", "large", "xlarge"]),
  message: PropTypes.string,
  fullScreen: PropTypes.bool,
  overlay: PropTypes.bool,
  className: PropTypes.string,
  showMessage: PropTypes.bool,
  variant: PropTypes.oneOf(["spinner", "dots", "pulse"]),
};

export default Loading;
