// frontend/src/components/ConnectionStatus.jsx
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { getConnectionStatus } from "../utils/messageSender";
import "./ConnectionStatus.sass";

const ConnectionStatus = () => {
  const [status, setStatus] = useState(getConnectionStatus());
  const io = useSelector((state) => state.io.io);

  useEffect(() => {
    const updateStatus = () => {
      setStatus(getConnectionStatus());
    };

    // Update status every 2 seconds
    const interval = setInterval(updateStatus, 2000);

    // Listen to socket events
    if (io) {
      io.on("connect", updateStatus);
      io.on("disconnect", updateStatus);
      io.on("connect_error", updateStatus);
    }

    return () => {
      clearInterval(interval);
      if (io) {
        io.off("connect", updateStatus);
        io.off("disconnect", updateStatus);
        io.off("connect_error", updateStatus);
      }
    };
  }, [io]);

  if (!status.hasSocket) return null;

  const getStatusColor = () => {
    if (status.isConnected) return "green";
    return "red";
  };

  const getStatusText = () => {
    if (status.isConnected) {
      return `Connected (${status.transport})`;
    }
    return "Disconnected";
  };

  return (
    <div className={`connection-status ${getStatusColor()}`}>
      <div className="status-indicator" />
      <span className="status-text">{getStatusText()}</span>
      {status.queueSize > 0 && (
        <span className="queue-size">({status.queueSize} queued)</span>
      )}
    </div>
  );
};

export default ConnectionStatus;
