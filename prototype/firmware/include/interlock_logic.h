#pragma once

#include <array>
#include <cctype>
#include <cstdint>
#include <cstring>
#include <string>

namespace interlock {

enum class Nozzle : std::uint8_t { NONE = 0, GASOLINE, ETHANOL, DIESEL_S10, DIESEL_S500, GNV };
enum class ApplyCode : std::uint8_t {
  APPLIED,
  DUPLICATE,
  REJECTED_INVALID_ID,
  REJECTED_STALE_SEQUENCE,
  REJECTED_INVALID_TTL,
  REJECTED_INVALID_NOZZLE
};

struct State {
  bool unlocked{false};
  Nozzle nozzle{Nozzle::NONE};
  std::uint32_t deadline_ms{0};
};

class Controller {
 public:
  static constexpr std::uint32_t kMaxTtlSeconds = 120;
  static constexpr std::size_t kHistorySize = 16;

  ApplyCode unlock(const char* command_id,
                   Nozzle nozzle,
                   std::uint32_t ttl_seconds,
                   std::uint32_t now_ms,
                   std::uint64_t sequence) {
    if (!validCommandId(command_id)) {
      forceLock();
      return ApplyCode::REJECTED_INVALID_ID;
    }
    if (seen(command_id)) return ApplyCode::DUPLICATE;
    if (sequence == 0 || sequence <= last_sequence_) {
      forceLock();
      return ApplyCode::REJECTED_STALE_SEQUENCE;
    }
    if (ttl_seconds == 0 || ttl_seconds > kMaxTtlSeconds) {
      forceLock();
      return ApplyCode::REJECTED_INVALID_TTL;
    }
    if (nozzle == Nozzle::NONE) {
      forceLock();
      return ApplyCode::REJECTED_INVALID_NOZZLE;
    }

    remember(command_id);
    last_sequence_ = sequence;
    state_.unlocked = true;
    state_.nozzle = nozzle;
    state_.deadline_ms = now_ms + ttl_seconds * 1000U;
    return ApplyCode::APPLIED;
  }

  ApplyCode lockAll(const char* command_id, std::uint64_t sequence) {
    if (!validCommandId(command_id)) {
      forceLock();
      return ApplyCode::REJECTED_INVALID_ID;
    }

    const bool duplicate = seen(command_id);
    if (!duplicate && (sequence == 0 || sequence <= last_sequence_)) {
      forceLock();
      return ApplyCode::REJECTED_STALE_SEQUENCE;
    }
    if (!duplicate) {
      remember(command_id);
      last_sequence_ = sequence;
    }
    // LOCK_ALL é seguro e idempotente: uma repetição nunca é ignorada fisicamente.
    forceLock();
    return duplicate ? ApplyCode::DUPLICATE : ApplyCode::APPLIED;
  }

  void forceLock() {
    state_.unlocked = false;
    state_.nozzle = Nozzle::NONE;
    state_.deadline_ms = 0;
  }

  bool tick(std::uint32_t now_ms) {
    if (!state_.unlocked) return false;
    // Comparação segura mesmo quando millis() dá a volta.
    if (static_cast<std::int32_t>(now_ms - state_.deadline_ms) < 0) return false;
    forceLock();
    return true;
  }

  bool primeCommandId(const char* command_id) {
    if (!validCommandId(command_id) || seen(command_id)) return false;
    remember(command_id);
    return true;
  }

  void primeSequence(std::uint64_t sequence) {
    if (sequence > last_sequence_) last_sequence_ = sequence;
  }

  [[nodiscard]] const State& state() const { return state_; }
  [[nodiscard]] std::uint64_t lastSequence() const { return last_sequence_; }
  [[nodiscard]] bool seen(const char* command_id) const {
    if (command_id == nullptr) return false;
    for (const auto& stored : history_) {
      if (!stored.empty() && stored == command_id) return true;
    }
    return false;
  }

  static bool validCommandId(const char* command_id) {
    if (command_id == nullptr) return false;
    const std::size_t length = std::strlen(command_id);
    if (length < 8 || length > 64) return false;
    for (std::size_t index = 0; index < length; ++index) {
      const unsigned char character = static_cast<unsigned char>(command_id[index]);
      if (!(std::isalnum(character) || character == '-' || character == '_')) return false;
    }
    return true;
  }

 private:
  void remember(const char* command_id) {
    history_[history_cursor_] = command_id;
    history_cursor_ = (history_cursor_ + 1U) % history_.size();
  }

  State state_{};
  std::array<std::string, kHistorySize> history_{};
  std::size_t history_cursor_{0};
  std::uint64_t last_sequence_{0};
};

inline const char* nozzleName(Nozzle nozzle) {
  switch (nozzle) {
    case Nozzle::GASOLINE: return "nozzle-gasoline";
    case Nozzle::ETHANOL: return "nozzle-ethanol";
    case Nozzle::DIESEL_S10: return "nozzle-diesel-s10";
    case Nozzle::DIESEL_S500: return "nozzle-diesel-s500";
    case Nozzle::GNV: return "nozzle-gnv";
    default: return "NONE";
  }
}

inline Nozzle parseNozzle(const char* value) {
  if (value == nullptr) return Nozzle::NONE;
  if (std::strcmp(value, "nozzle-gasoline") == 0 || std::strcmp(value, "GASOLINE") == 0) return Nozzle::GASOLINE;
  if (std::strcmp(value, "nozzle-ethanol") == 0 || std::strcmp(value, "ETHANOL") == 0) return Nozzle::ETHANOL;
  if (std::strcmp(value, "nozzle-diesel-s10") == 0 || std::strcmp(value, "DIESEL_S10") == 0) return Nozzle::DIESEL_S10;
  if (std::strcmp(value, "nozzle-diesel-s500") == 0 || std::strcmp(value, "DIESEL_S500") == 0) return Nozzle::DIESEL_S500;
  if (std::strcmp(value, "nozzle-gnv") == 0 || std::strcmp(value, "GNV") == 0) return Nozzle::GNV;
  return Nozzle::NONE;
}

inline const char* applyCodeName(ApplyCode code) {
  switch (code) {
    case ApplyCode::APPLIED: return "APPLIED";
    case ApplyCode::DUPLICATE: return "DUPLICATE";
    case ApplyCode::REJECTED_INVALID_ID: return "REJECTED_INVALID_ID";
    case ApplyCode::REJECTED_STALE_SEQUENCE: return "REJECTED_STALE_SEQUENCE";
    case ApplyCode::REJECTED_INVALID_TTL: return "REJECTED_INVALID_TTL";
    case ApplyCode::REJECTED_INVALID_NOZZLE: return "REJECTED_INVALID_NOZZLE";
    default: return "REJECTED";
  }
}

}  // namespace interlock
