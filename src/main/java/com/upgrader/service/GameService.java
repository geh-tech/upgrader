package com.upgrader.service;

import com.upgrader.dao.*;
import com.upgrader.models.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GameService {
    private static final Map<Integer, BattleState> battleStates = new ConcurrentHashMap<>();

    public static List<InventoryItem> getFullInventory(int userId) {
        return InventoryDao.getInventory(userId);
    }

    public static void equipItem(int userId, int invId) {
        InventoryItem invItem = InventoryDao.getInventoryItemById(invId);
        if (invItem == null || invItem.userId != userId) return;

        Item item = ItemDao.getItemById(invItem.itemId);
        String slot = item.slot;

        List<InventoryItem> all = InventoryDao.getInventory(userId);
        for (InventoryItem other : all) {
            if (other.equipped) {
                Item otherItem = ItemDao.getItemById(other.itemId);
                if (otherItem.slot.equals(slot)) {
                    InventoryDao.updateEquipped(other.id, false);
                }
            }
        }
        InventoryDao.updateEquipped(invId, true);
    }

    public static boolean upgradeItem(int userId, int invId, int chancePercent) {
        InventoryItem invItem = InventoryDao.getInventoryItemById(invId);
        if (invItem == null || invItem.userId != userId) return false;

        int roll = (int)(Math.random() * 100);
        if (roll < chancePercent) {
            InventoryDao.upgradeLevel(invId);
            return true;
        } else {
            InventoryDao.deleteItem(invId);
            return false;
        }
    }

    public static int createBattle(int userId, int opponentId) {
        int battleId = BattleDao.createBattle("1v1", "active");
        BattleDao.addParticipant(battleId, userId, 0, "alive");
        BattleDao.addParticipant(battleId, opponentId, 0, "alive");

        BattleState state = new BattleState();
        state.battleId = battleId;
        state.userIds = Arrays.asList(userId, opponentId);
        state.hp = new HashMap<>();
        state.hp.put(userId, UserDao.getUserById(userId).currentHp);
        state.hp.put(opponentId, UserDao.getUserById(opponentId).currentHp);
        state.currentTurn = userId;
        state.status = "active";
        battleStates.put(battleId, state);

        return battleId;
    }

    public static void performAction(int battleId, int userId, int targetId) {
        BattleState state = battleStates.get(battleId);
        if (state == null || !state.status.equals("active")) return;
        if (state.currentTurn != userId) return;

        User attacker = UserDao.getUserById(userId);
        User target = UserDao.getUserById(targetId);

        int attackerDamage = 5;
        int targetArmor = 0;

        List<InventoryItem> attInv = InventoryDao.getInventory(userId);
        for (InventoryItem ii : attInv) {
            if (ii.equipped) {
                Item item = ItemDao.getItemById(ii.itemId);
                if (item.slot.startsWith("weapon")) {
                    attackerDamage += item.damage * (1 + ii.upgradeLevel);
                }
                if (item.slot.equals("head") || item.slot.equals("body") || item.slot.equals("legs") ||
                    item.slot.equals("arms") || item.slot.equals("boots") || item.slot.equals("gloves") ||
                    item.slot.equals("neck")) {
                    targetArmor += item.armor * (1 + ii.upgradeLevel);
                }
            }
        }
        List<InventoryItem> targetInv = InventoryDao.getInventory(targetId);
        for (InventoryItem ii : targetInv) {
            if (ii.equipped) {
                Item item = ItemDao.getItemById(ii.itemId);
                if (item.slot.equals("head") || item.slot.equals("body") || item.slot.equals("legs") ||
                    item.slot.equals("arms") || item.slot.equals("boots") || item.slot.equals("gloves") ||
                    item.slot.equals("neck")) {
                    targetArmor += item.armor * (1 + ii.upgradeLevel);
                }
            }
        }

        int damage = Math.max(1, attackerDamage - targetArmor / 2 + (int)(Math.random() * 10));
        int newHp = state.hp.get(targetId) - damage;
        if (newHp < 0) newHp = 0;
        state.hp.put(targetId, newHp);
        target.currentHp = newHp;
        UserDao.updateUser(target);

        if (newHp <= 0) {
            List<InventoryItem> equipped = InventoryDao.getEquippedItems(targetId);
            for (InventoryItem ii : equipped) {
                InventoryDao.addItem(userId, ii.itemId, ii.upgradeLevel);
                InventoryDao.deleteItem(ii.id);
            }
            attacker.coins += 10;
            attacker.exp += 50;
            while (attacker.exp >= 100) {
                attacker.exp -= 100;
                attacker.level += 1;
                attacker.maxHp += 10;
                attacker.currentHp = attacker.maxHp;
            }
            UserDao.updateUser(attacker);

            state.status = "finished";
            BattleDao.updateBattleStatus(battleId, "finished");
            BattleDao.updateParticipantStatus(battleId, targetId, "dead");
            BattleDao.updateParticipantStatus(battleId, userId, "alive");
            battleStates.put(battleId, state);
        } else {
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

    private static class BattleState {
        int battleId;
        List<Integer> userIds;
        Map<Integer, Integer> hp;
        int currentTurn;
        String status;
    }
}