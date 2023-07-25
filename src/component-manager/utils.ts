/*
 * Copyright 2021 Espressif Systems (Shanghai) CO LTD
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { existsSync } from 'fs';
import { Logger } from "../logger/logger";
import { spawn, appendIdfAndToolsToPath } from "../utils";
import { LocDictionary } from "../localizationDictionary";
import { Uri } from "vscode";
import { readParameter } from "../idfConfiguration";
import { join } from "path";

const locDict = new LocDictionary("ComponentRegistryPanel");

export async function addDependency(
  workspace: Uri,
  dependency: string,
  component: string
) {
  try {
    const idfPathDir = readParameter("idf.espIdfPath", workspace);
    const idfPy = join(idfPathDir, "tools", "idf.py");
    const modifiedEnv = appendIdfAndToolsToPath(workspace);
    const pythonBinPath = readParameter("idf.pythonBinPath", workspace) as string;
    const enableCCache = readParameter("idf.enableCCache", workspace) as boolean;
    const addDependencyArgs: string[] = [idfPy];
    if (enableCCache) {
      addDependencyArgs.push("--ccache")
    }
    addDependencyArgs.push("add-dependency", `--component=${component}`, dependency, "reconfigure");
    const addDependencyResult = await spawn(
      pythonBinPath,
      addDependencyArgs,
      {
        cwd: workspace.fsPath,
        env: modifiedEnv,
      }
    );
    Logger.infoNotify(
      `Added dependency ${dependency} to the component "${component}"`
    );
    Logger.info(addDependencyResult.toString());
  } catch (error) {
    const throwableError = new Error(
      locDict.localize(
        "idfpy.commandError",
        `Error encountered while adding dependency ${dependency} to the component "${component}"`
      )
    );
    Logger.error(error.message, error);
    throw throwableError;
  }
}

export async function createProject(
  workspace: Uri,
  example: string
): Promise<void> {
  try {
    const idfPathDir = readParameter("idf.espIdfPath");
    const idfPy = join(idfPathDir, "tools", "idf.py");
    const pythonBinPath = readParameter("idf.pythonBinPath") as string;

    if (!existsSync(idfPathDir) || !existsSync(idfPy) || !existsSync(pythonBinPath)) {
      throw new Error('The paths to idf, idf.py or pythonBin do not exist.');
    }

    const createProjectCommand: string[] = [idfPy, "create-project-from-example", `${example}`];
    
    const createProjectResult = await spawn(
      pythonBinPath,
      createProjectCommand,
      {
        cwd: workspace.fsPath,
        env: process.env,
      }
    );

    Logger.infoNotify(
      `Creating project from ${example}"`
    );
    Logger.info(createProjectResult.toString());

  } catch (error) {
    const throwableError = new Error(
      `${locDict.localize(
        "idfpy.commandError",
        `Error encountered while creating project from example ${example}"`
      )}. Original error: ${error.message}`
    );
    Logger.error(error.message, error);
    throw throwableError;
  }
}
