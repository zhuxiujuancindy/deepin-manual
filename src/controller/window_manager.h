/*
 * Copyright (C) 2017 ~ 2018 Deepin Technology Co., Ltd.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef DEEPIN_MANUAL_CONTROLLER_WINDOW_MANAGER_H
#define DEEPIN_MANUAL_CONTROLLER_WINDOW_MANAGER_H

#include <QHash>
#include <QObject>
#include <QPoint>

namespace dman {

class SearchManager;
class WebWindow;

// Manages visibility and lifecycle of web windows.
// Current process will exit only if all of these windows are closed.
class WindowManager : public QObject {
  Q_OBJECT
 public:
  explicit WindowManager(QObject* parent = nullptr);
  ~WindowManager() override;

  /**
   * Open manual page of application with name |app_name|.
   * If manual of that app has already been presented, just raise to front.
   */
  void openManual(const QString& app_name);

 private:
  QPoint newWindowPosition();

  QHash<QString, WebWindow*> windows_;
  SearchManager* search_manager_ = nullptr;
  QPoint last_new_window_pos_;

 private slots:
  /**
   * Remove window from window list.
   * @param app_name
   */
  void onWindowClosed(const QString& app_name);
};

}  // namespace dman

#endif  // DEEPIN_MANUAL_CONTROLLER_WINDOW_MANAGER_H
