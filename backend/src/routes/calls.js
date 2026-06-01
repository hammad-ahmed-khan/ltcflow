const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Room = require('../models/Room');
const User = require('../models/User');

// Record a missed call
router.post('/missed', async (req, res) => {
  try {
    const { callerId, calleeId, callType, isGroup, groupId, meetingId } = req.body;

    // Get caller information
    const caller = await User.findById(callerId).select('firstName lastName picture');
    if (!caller) {
      return res.status(404).json({ error: 'Caller not found' });
    }

    let groupName = null;
    if (isGroup && groupId) {
      const group = await Room.findById(groupId).select('title');
      groupName = group ? group.title : 'Unknown Group';
    }

    const missedCallData = {
      _id: meetingId || `missed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      caller: {
        _id: caller._id,
        firstName: caller.firstName,
        lastName: caller.lastName,
        picture: caller.picture,
      },
      callType,
      timestamp: new Date(),
      status: 'missed',
      isGroup: isGroup || false,
      groupId: groupId || null,
      groupName,
    };

    // Emit to the callee that they have a missed call
    req.io.to(calleeId).emit('call-missed', missedCallData);

    console.log(`📞 Missed call recorded: ${caller.firstName} ${caller.lastName} -> ${calleeId}`);

    res.json({ success: true, missedCall: missedCallData });
  } catch (error) {
    console.error('Error recording missed call:', error);
    res.status(500).json({ error: 'Failed to record missed call' });
  }
});

// Record call end and duration
router.post('/end', async (req, res) => {
  try {
    const { roomId, callType, duration, callerId, startTime } = req.body;

    if (!roomId || !callerId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const caller = await User.findById(callerId).select('firstName lastName picture');
    if (!caller) {
      return res.status(404).json({ error: 'Caller not found' });
    }

    // Only create call record if call lasted more than 3 seconds
    if (duration && duration > 3) {
      // Create call record message
      const callMessage = new Message({
        room: roomId,
        author: callerId,
        content: JSON.stringify({
          callType,
          duration,
          status: 'ended',
          startTime: startTime || new Date(),
        }),
        type: 'call-record',
        createdAt: new Date(),
      });

      await callMessage.save();
      await callMessage.populate('author');

      // Emit the call record to room participants
      req.io.to(roomId).emit('call-ended', {
        messageId: callMessage._id,
        caller: callMessage.author,
        callType,
        duration,
        roomId,
        message: callMessage,
      });

      console.log(`📞 Call ended and recorded: ${duration}s ${callType} call in room ${roomId}`);
    }

    res.json({ success: true, duration });
  } catch (error) {
    console.error('Error recording call end:', error);
    res.status(500).json({ error: 'Failed to record call end' });
  }
});

module.exports = router;
