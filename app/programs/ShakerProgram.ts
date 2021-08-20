import Matter from "matter-js";
import { LobbyController } from "../LobbyController";
import { Program } from "./Program";
import { SaftlimacherBaseProgram } from "./SaftlimacherBaseProgram";

export class ShakerProgram extends SaftlimacherBaseProgram implements Program {

  // world
  private gravityX: number = 0;
  private gravityY: number = 0;

  // shaking
  private shaking = false;
  private shakeCounter: number = 0;
  private shakePointsNeededForFalling: number = 50;
  private secondsForFalling = 0.8;
  private fallBlocked = false;

  // shake object change
  private shakeObjectChangeTimerId?: NodeJS.Timeout;
  private shakeObjectChangeAfterSeconds: number = 5;
  private maxAmountOfIngredientTypes = 4;
  private currentRandomShakingObjectNumber = 0;
  private oldShakeObjectNumber = -1;

  // shaker container
  private shakerContainer?: Matter.Body;
  private shakerContainerPosX = 0;
  private shakerContainerPosY = 0;
  private shakerContainerRadius = 50;

  // ingredient
  private ingredient?: Matter.Body;
  private ingredientPosX = 0;
  private ingredientPosY = 0;
  private ingredientRadius = 50;

  constructor(lobbyController: LobbyController) {
    super(lobbyController);
  }

  /* -------------------- SHAKER GAME LOOP --------------------*/
  initGameLoop(fps: number) {
    this.initShakeObjectTimer();

    this.gameLoop = setInterval(() => {
      if (this.engine == null) return;
      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);

      this.lobbyController.sendToDisplays('updateShaking', this.shaking);
      this.lobbyController.sendToDisplays('updateScore', this.score);
      this.lobbyController.sendToDisplays('updateShakeCounter', this.shakeCounter);

      // shakecounter decreases constantly (progressbar empties)
      this.reduceShakeCounter();

    }, 1000 / fps);
  }


  /* -------------------- SHAKER GAME METHODS --------------------*/

  private reduceShakeCounter() {
    this.shakeCounter = this.shakeCounter - 0.1;
    if (this.shakeCounter < 0) {
      this.shakeCounter = 0;
    }
  }

  private initShakeObjectTimer(): void {
    // change shakeObject after X seconds
    this.shakeObjectChangeTimerId = setInterval(() => this.triggerChangeShakeObject(), this.shakeObjectChangeAfterSeconds * 1000);
  }

  private initShakerContainer(): void {
    if (this.engine == null) return;

    this.shakerContainer = Matter.Bodies.circle(
      this.shakerContainerPosX,
      this.shakerContainerPosY,
      this.shakerContainerRadius,
      {
        label: 'Shaker',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.shakerContainer);
  }

  initIngredients(): void {
    if (this.engine == null) return;

    this.ingredient = Matter.Bodies.circle(
      this.ingredientPosX,
      this.ingredientPosY,
      this.ingredientRadius,
      {
        label: 'Ingredient',
      });
    Matter.World.add(this.engine.world, this.ingredient);
  }

  initLevelData() {
    this.initShakerContainer();
    this.initIngredients();
  }

  initMatterEventCollision() {
    // no collision detection in shakerProgram
  }

  setControllerDataPlayer1(controllerData: any): void {
    this.shakeMovement();
  }

  setControllerDataPlayer2(controllerData: any): void {
    this.shakeMovement();
  }

  private shakeMovement(): void {
    // shaking!
    this.shaking = true;

    if (this.shakeCounter < this.shakePointsNeededForFalling) {
      this.shakeCounter++;

    } else if (this.shakeCounter >= this.shakePointsNeededForFalling) {
      this.shakeCounter = this.shakePointsNeededForFalling;

      if (!this.fallBlocked) {
        // lock fall
        this.fallBlocked = true;

        setTimeout(() => {
          // let ingredient fall
          this.triggerFallOfIngredient(this.currentRandomShakingObjectNumber);
          this.shakeCounter = this.shakeCounter * 0.6;
          this.fallBlocked = false;

        }, 100);
      }
    }
    setTimeout(() => { this.shaking = false; }, 50);
  }

  private triggerFallOfIngredient(ingredientNumber: number): void {
    this.lobbyController.sendToDisplays('updateFall', true);
    setTimeout(() => {
      if (this.allIngredientNumbersOnList.includes(ingredientNumber)) {
        // good catch
        this.score += this.scoreInc;
        this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientNumber);
        this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [this.scoreInc, ingredientNumber]);

      } else if (this.isInedible(ingredientNumber)) {
        // beatle iiiih
        this.score -= this.scoreInc * 2;
        this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [-(this.scoreInc * 2), ingredientNumber]);
      } else {
        // bad catch
        this.score -= this.scoreInc;
        this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient', [-this.scoreInc, ingredientNumber]);
      }
    }, this.secondsForFalling * 1000);
  }

  private triggerChangeShakeObject(): void {
    this.oldShakeObjectNumber = this.currentRandomShakingObjectNumber;
    this.currentRandomShakingObjectNumber = this.getRandomInt(this.maxAmountOfIngredientTypes);

    while (this.oldShakeObjectNumber == this.currentRandomShakingObjectNumber) {
      // avoid changing to the same shakeObject (i.e. 2x apple tree)
      this.currentRandomShakingObjectNumber = this.getRandomInt(this.maxAmountOfIngredientTypes);
    }
    this.lobbyController.sendToDisplays('changeShakeObject', this.currentRandomShakingObjectNumber);

    if (this.shakeObjectChangeTimerId != null) clearInterval(this.shakeObjectChangeTimerId);
    if (!this.allIngredientNumbersOnList.includes(this.currentRandomShakingObjectNumber)) {
      // change tree quicker if fruits not needed
      this.shakeObjectChangeTimerId = setInterval(() => this.triggerChangeShakeObject(), (this.shakeObjectChangeAfterSeconds / 2) * 1000);

    } else {
      if (this.shakeObjectChangeTimerId != null) {
        // change tree
        this.shakeObjectChangeTimerId = setInterval(() => this.triggerChangeShakeObject(), (this.shakeObjectChangeAfterSeconds) * 1000);
      }
    }

    // new plant -> shake effect back to 0
    this.shakeCounter = 0;
  }

  collectLevelData() {
    let data: any[] = [];
    // 0 -> list
    data.push(this.allIngredientNumbersOnList);
    // 1 -> shakepoints needed
    data.push(this.shakePointsNeededForFalling);

    return data;
  }

  clearInGameTimers() {
    if (this.shakeObjectChangeTimerId != null) clearInterval(this.shakeObjectChangeTimerId);
  }

  createWorldBounds(): void {
    if (this.engine == null) return;

    Matter.World.add(this.engine.world, [
      // Left
      Matter.Bodies.rectangle(this.worldSideMargin, this.height / 2, 10, this.height, {
        isStatic: true,
      }),
      // Bottom
      // not visible, further down. trigger for respawning fruit
      Matter.Bodies.rectangle(this.width / 2, this.height + 400, this.width, 10, {
        label: 'Floor',
        isStatic: true,
        isSensor: true
      }),
      // Right
      Matter.Bodies.rectangle(this.width - this.worldSideMargin, this.height / 2, 10, this.height, {
        isStatic: true
      })
    ])
  }

}