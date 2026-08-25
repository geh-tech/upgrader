package com.upgrader.service;

import com.upgrader.dao.InventoryDao;
import com.upgrader.dao.UserDao;
import com.upgrader.models.User;

import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class TopService {
    private static final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    public static void startHourlyReward() {
        scheduler.scheduleAtFixedRate(() -> {
            List<User> top = UserDao.getTopPlayers(10);
            for (User user : top) {
                int randomItemId = (int)(Math.random() * 5) + 1;
                InventoryDao.addItem(user.id, randomItemId, 0);
                System.out.println("Награда выдана игроку " + user.nickname);
            }
        }, 0, 1, TimeUnit.HOURS);
    }
}