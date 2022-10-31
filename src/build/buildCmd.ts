/*
 * Project: ESP-IDF VSCode Extension
 * File Created: Friday, 30th April 2021 9:26:11 pm
 * Copyright 2021 Espressif Systems (Shanghai) CO LTD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { pathExists } from "fs-extra";
import { BuildTask } from "./buildTask";
import { FlashTask } from "../flash/flashTask";
import { LocDictionary } from "../localizationDictionary";
import * as vscode from "vscode";
import { Logger } from "../logger/logger";
import { TaskManager } from "../taskManager";
import { join } from "path";
import { updateIdfComponentsTree } from "../workspaceConfig";
import { IdfSizeTask } from "../espIdf/size/idfSizeTask";
import { CustomTask, CustomTaskType } from "../customTasks/customTaskProvider";
import { readParameter } from "../idfConfiguration";
import { ESP } from "../config";

const locDic = new LocDictionary(__filename);
const fileTag:string = "Build";

export async function buildCommand(
  workspace: vscode.Uri,
  cancelToken: vscode.CancellationToken,
  flashType: ESP.FlashType
) {
  let continueFlag = true;
  const buildTask = new BuildTask(workspace);
  const sizeTask = new IdfSizeTask(workspace);
  const customTask = new CustomTask(workspace);
  if (BuildTask.isBuilding || FlashTask.isFlashing) {
    const waitProcessIsFinishedMsg = locDic.localize(
      "build.waitProcessIsFinishedMessage",
      "Wait for ESP-IDF build or flash to finish"
    );
    Logger.errorNotify(
      waitProcessIsFinishedMsg,
      new Error("One_Task_At_A_Time"),
      [fileTag]
    );
    return;
  }
  cancelToken.onCancellationRequested(() => {
    TaskManager.cancelTasks();
    TaskManager.disposeListeners();
    buildTask.building(false);
  });
  try {
    customTask.addCustomTask(CustomTaskType.PreBuild);
    await buildTask.build();
    await TaskManager.runTasks();
    await sizeTask.getSizeInfo();
    customTask.addCustomTask(CustomTaskType.PostBuild);
    await TaskManager.runTasks();
    if (flashType === ESP.FlashType.DFU) {
      const buildPath = readParameter(
        "idf.buildPath",
        workspace
      ) as string;
      if (!(await pathExists(join(buildPath, "flasher_args.json")))) {
        return Logger.errorNotify(
          "flasher_args.json file is missing from the build directory, can't proceed, please build properly!!",
          new Error("MISSING_FLASHER_ARGS.JSON"),
          [fileTag]
        );
      }
      const adapterTargetName = readParameter("idf.adapterTargetName", workspace) as string;
      if (adapterTargetName !== "esp32s2" && adapterTargetName !== "esp32s3") {
        return Logger.warnNotify(
          `The selected device target "${adapterTargetName}" is not compatible for DFU, as a result the DFU.bin was not created.`,
          [fileTag]
        );
      }
      await buildTask.buildDfu();
      await TaskManager.runTasks();
    }
    if (!cancelToken.isCancellationRequested) {
      updateIdfComponentsTree(workspace);
      Logger.infoNotify("Build Successfully", [fileTag]);
      TaskManager.disposeListeners();
    }
  } catch (error) {
    if (error.message === "ALREADY_BUILDING") {
      return Logger.errorNotify("Already a build is running!", error, [fileTag]);
    }
    if (error.message === "BUILD_TERMINATED") {
      return Logger.warnNotify(`Build is Terminated`, [fileTag]);
    }
    Logger.errorNotify(
      "Something went wrong while trying to build the project",
      error,
      [fileTag]
    );
    continueFlag = false;
  }
  buildTask.building(false);
  return continueFlag;
}
