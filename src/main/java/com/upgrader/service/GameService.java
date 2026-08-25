package com.upgrader.service;

import com.upgrader.dao.*;
import com.upgrader.models.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GameService {
    // Храним состояние боя в памяти (для простоты)
    private static final Map<Integer, BattleState> battleStates = new ConcurrentHashMap<>();

    public static List<InventoryItem> getFullInventory(int userId) {
        return InventoryDao.getInventory(userId);
    }

    public static void equipItem(int userId, int invId) {
        InventoryItem invItem = InventoryDao.getInventoryItemById(invId);
        if (invItem == null || invItem.getUserId() != userId) return;

        Item item = ItemDao.getItemById(invItem.getItemId());
        String slot = item.getSlot();

        // Снимаем все экипированные предметы в этом слоте
        List<InventoryItem> all = InventoryDao.getInventory(userId);
        for (InventoryItem other : all) {
            if (other.isEquipped()) {
                Item otherItem = ItemDao.getItemById(other.getItemId());
                if (otherItem.getSlot().equals(slot)) {
                    InventoryDao.updateEquipped(other.getId(), false);
                }
            }
        }
        // Экипируем выбранный
        InventoryDao.updateEquipped(invId, true);
    }

    public static boolean upgradeItem(int userId, int invId, int chancePercent) {
        InventoryItem invItem = InventoryDao.getInventoryItemById(invId);
        if (invItem == null || invItem.getUserId() != userId) return false;

        int roll = (int)(Math.random() * 100);
        if (roll < chancePercent) {
            // Успех
            InventoryDao.upgradeLevel(invId);
            return true;
        } else {
            // Провал – предмет исчезает
            InventoryDao.deleteItem(invId);
            return false;
        }
    }

    // Создание боя 1v1 (упрощённо)
    public static int createBattle(int userId, int opponentId) {
        int battleId = BattleDao.createBattle("1v1", "active");
        BattleDao.addParticipant(battleId, userId, 0, "alive");
        BattleDao.addParticipant(battleId, opponentId, 0, "alive");

        // Инициализируем состояние боя в памяти
        BattleState state = new BattleState();
        state.battleId = battleId;
        state.userIds = Arrays.asList(userId, opponentId);
        state.hp = new HashMap<>();
        state.hp.put(userId, UserDao.getUserById(userId).getCurrentHp());
        state.hp.put(opponentId, UserDao.getUserById(opponentId).getCurrentHp());
        state.currentTurn = userId; // первый ход
        state.status = "active";
        battleStates.put(battleId, state);

        return battleId;
    }

    public static void performAction(int battleId, int userId, int targetId) {
        BattleState state = battleStates.get(battleId);
        if (state == null || !state.status.equals("active")) return;

        // Проверка, чей ход
        if (state.currentTurn != userId) return;

        // Расчет урона
        User attacker = UserDao.getUserById(userId);
        User target = UserDao.getUserById(targetId);

        // Получаем оружие (damage) и броню (armor) из экипировки
        int attackerDamage = 5; // базовый
        int targetArmor = 0;
        List<InventoryItem> attInv = InventoryDao.getInventory(userId);
        for (InventoryItem ii : attInv) {
            if (ii.isEquipped()) {
                Item item = ItemDao.getItemById(ii.getItemId());
                if (item.getSlot().startsWith("weapon")) {
                    attackerDamage += item.getDamage() * (1 + ii.getUpgradeLevel());
                }
                if (item.getSlot().equals("head") || item.getSlot().equals("body") || item.getSlot().equals("legs") ||
                    item.getSlot().equals("arms") || item.getSlot().equals("boots") || item.getSlot().equals("gloves") ||
                    item.getSlot().equals("neck")) {
                    targetArmor += item.getArmor() * (1 + ii.getUpgradeLevel()); // упрощённо
                }
            }
        }
        // Учитываем броню цели
        List<InventoryItem> targetInv = InventoryDao.getInventory(targetId);
        for (InventoryItem ii : targetInv) {
            if (ii.isEquipped()) {
                Item item = ItemDao.getItemById(ii.getItemId());
                if (item.getSlot().equals("head") || item.getSlot().equals("body") || item.getSlot().equals("legs") ||
                    item.getSlot().equals("arms") || item.getSlot().equals("boots") || item.getSlot().equals("gloves") ||
                    item.getSlot().equals("neck")) {
                    targetArmor += item.getArmor() * (1 + ii.getUpgradeLevel());
                }
            }
        }

        int damage = Math.max(1, attackerDamage - targetArmor / 2 + (int)(Math.random() * 10));
        int newHp = state.hp.get(targetId) - damage;
        if (newHp < 0) newHp = 0;
        state.hp.put(targetId, newHp);
        // Обновляем HP в БД для цели
        target.setCurrentHp(newHp);
        UserDao.updateUser(target);

        // Проверка смерти
        if (newHp <= 0) {
            // Победитель – attacker
            // Передаём экипировку
            List<InventoryItem> equipped = InventoryDao.getEquippedItems(targetId);
            for (InventoryItem ii : equipped) {
                // Передаём победителю
                InventoryDao.addItem(userId, ii.getItemId(), ii.getUpgradeLevel());
                // Удаляем у проигравшего
                InventoryDao.deleteItem(ii.getId());
            }
            // Награда: 10 монет и опыт
            attacker.setCoins(attacker.getCoins() + 10);
            attacker.setExp(attacker.getExp() + 50); // опыт
            // Проверка повышения уровня
            while (attacker.getExp() >= 100) {
                attacker.setExp(attacker.getExp() - 100);
                attacker.setLevel(attacker.getLevel() + 1);
                attacker.setMaxHp(attacker.getMaxHp() + 10);
                attacker.setCurrentHp(attacker.getMaxHp());
            }
            UserDao.updateUser(attacker);

            // Обновляем статус боя
            state.status = "finished";
            BattleDao.updateBattleStatus(battleId, "finished");
            BattleDao.updateParticipantStatus(battleId, targetId, "dead");
            BattleDao.updateParticipantStatus(battleId, userId, "alive");
            battleStates.put(battleId, state);
        } else {
            // Смена хода
            // Просто переключаем на другого участника (для 1v1)
            List<Integer> participants = BattleDao.getParticipants(battleId);
            for (int uid : participants) {
                if (uid != userId && state.hp.getOrDefault(uid, 0) > 0) {
                    state.currentTurn = uid;
                    break;
                }
            }
            battleStates.put(battleId, state);
        }
    }

    public static Object getBattleStatus(int battleId) {
        BattleState state = battleStates.get(battleId);
        if (state == null) return null;
        Map<String, Object> status = new HashMap<>();
        status.put("battleId", battleId);
        status.put("status", state.status);
        status.put("currentTurn", state.currentTurn);
        status.put("hp", state.hp);
        return status;
    }

    // Внутренний класс для состояния боя
    private static class BattleState {
        int battleId;
        List<Integer> userIds;
        Map<Integer, Integer> hp;
        int currentTurn;
        String status;
    }
}