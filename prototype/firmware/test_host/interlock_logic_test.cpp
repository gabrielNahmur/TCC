#include <cassert>
#include <cstdint>
#include <iostream>

#include "interlock_logic.h"

int main() {
  using interlock::ApplyCode;
  using interlock::Controller;
  using interlock::EmergencyStopEdge;
  using interlock::EmergencyStopTransition;
  using interlock::Nozzle;

  EmergencyStopEdge emergency_stop;
  assert(emergency_stop.update(false) == EmergencyStopTransition::NONE);
  assert(emergency_stop.update(true) == EmergencyStopTransition::ACTIVATED);
  assert(emergency_stop.active());
  assert(emergency_stop.update(true) == EmergencyStopTransition::NONE);
  assert(emergency_stop.update(false) == EmergencyStopTransition::RELEASED);
  assert(!emergency_stop.active());
  assert(emergency_stop.update(false) == EmergencyStopTransition::NONE);

  Controller controller;
  assert(!controller.state().unlocked);
  assert(interlock::parseNozzle("nozzle-diesel-s10") == Nozzle::DIESEL_S10);
  assert(interlock::parseNozzle("nozzle-diesel-s500") == Nozzle::DIESEL_S500);
  assert(std::string(interlock::nozzleName(Nozzle::GASOLINE)) == "nozzle-gasoline");

  assert(controller.unlock("command_0001", Nozzle::GASOLINE, 30, 1000, 1) == ApplyCode::APPLIED);
  assert(controller.state().unlocked);
  assert(controller.state().nozzle == Nozzle::GASOLINE);
  const std::uint32_t original_deadline = controller.state().deadline_ms;

  // Retransmissão não estende o TTL nem muda a saída.
  assert(controller.unlock("command_0001", Nozzle::ETHANOL, 60, 5000, 1) == ApplyCode::DUPLICATE);
  assert(controller.state().nozzle == Nozzle::GASOLINE);
  assert(controller.state().deadline_ms == original_deadline);

  assert(!controller.tick(30999));
  assert(controller.tick(31000));
  assert(!controller.state().unlocked);

  // TTL inválido e bico desconhecido falham bloqueados.
  assert(controller.unlock("command_0002", Nozzle::DIESEL_S10, 121, 32000, 2) == ApplyCode::REJECTED_INVALID_TTL);
  assert(!controller.state().unlocked);
  assert(controller.unlock("command_0003", Nozzle::NONE, 20, 32000, 2) == ApplyCode::REJECTED_INVALID_NOZZLE);
  assert(!controller.state().unlocked);

  // LOCK_ALL repetido continua aplicando o estado físico seguro.
  assert(controller.unlock("command_0004", Nozzle::GNV, 10, 33000, 2) == ApplyCode::APPLIED);
  assert(controller.lockAll("command_0005", 3) == ApplyCode::APPLIED);
  assert(!controller.state().unlocked);
  assert(controller.lockAll("command_0005", 3) == ApplyCode::DUPLICATE);
  assert(!controller.state().unlocked);

  // Um UNLOCK atrasado, anterior ao LOCK_ALL, não pode reabrir a bancada.
  assert(controller.unlock("command_0006", Nozzle::DIESEL_S500, 20, 34000, 2) == ApplyCode::REJECTED_STALE_SEQUENCE);
  assert(!controller.state().unlocked);

  // A comparação de prazo funciona ao redor da volta de uint32_t.
  assert(controller.unlock("command_0007", Nozzle::ETHANOL, 1, UINT32_MAX - 499U, 4) == ApplyCode::APPLIED);
  assert(!controller.tick(499U));
  assert(controller.tick(500U));

  // O maior sequence persistido impede replay mesmo após reconstruir o controlador.
  Controller restarted;
  restarted.primeSequence(50);
  assert(restarted.unlock("command_0050", Nozzle::GASOLINE, 10, 100, 50) == ApplyCode::REJECTED_STALE_SEQUENCE);
  assert(restarted.unlock("command_0051", Nozzle::GASOLINE, 10, 100, 51) == ApplyCode::APPLIED);

  std::cout << "interlock_logic: todos os testes passaram\n";
  return 0;
}
